---
title: "RFC-003: Resolution & the Attribute Model"
description: How the Resolver selects a ResourceDefinition for a Resource — the ResolutionContext and its sources, the attribute model, access/outputs matching, and cross-application reference resolution.
---

| | |
|---|---|
| **Status** | Draft for review |
| **Series** | [RFC-001: Domain Model & Ownership Boundaries](rfc-001-domain-model-and-ownership.md) · [RFC-002: The SCORE Profile](rfc-002-score-profile.md) · RFC-003 (this document) |
| **Scope** | How the Resolver selects a ResourceDefinition for a Resource: the ResolutionContext and its sources, the attribute model, access/outputs matching, and cross-application reference resolution |
| **Audience** | Platform teams authoring vocabulary, definitions, and policies; implementers of the Resolver |
| **Date** | 2026-08-04 (split from the 2026-08-03 combined RFC) |

> **Series conventions.** Rule numbers are global across the series; this document holds **R7, R8, R12, and R13**. Entities (Resolver, ResolutionContext, AttributeSchema, AttributeSource, ResourceType, ResourceDefinition, EnvironmentType, Policy, …) are defined in the RFC-001 glossary; the SCORE-facing interpretation feeding resolution is RFC-002 (R1, R2). The decision log lives in RFC-001 §8/§10.

---

## 1. The resolution pipeline

For each Resource requiring resolution, the Resolver:

1. **Assembles the ResolutionContext** exclusively from registered AttributeSources (R13).
2. **Filters candidates**: all registered ResourceDefinitions realizing the Resource's `type` (and matching its `class`), evaluated by their matching criteria over the context, subject to Policies — including access-subset matching (R7) and reference-target rules (R8, R12) for consumer RBRs.
3. **Selects or fails explainably**, emitting a full trace either way (R10, RFC-001): serialized context with per-attribute provenance, per-candidate match/exclusion reasons, Policies applied, final outcome.

The Resolver never invents infrastructure (principle 4, RFC-001): it selects among registered ResourceDefinitions only, and provisioning is a strictly downstream concern delegated to the selected definition's ResourceDriver.

## 2. The ResolutionContext and its sources

The ResolutionContext is a *computed value object*: assembled fresh per resolution, never stored as an object, persisted only serialized inside explainability traces. Its contents come **exclusively** from registered AttributeSources (R13) — there is no side channel. Policies are applied *over* the context by the Resolver, never contributed *into* it.

The controller ships three built-in sources:

1. **Environment attributes** — attribute key/values authored on the Environment, vocabulary-validated at admission (R9, RFC-001). The EnvironmentType rides along as a property of the Environment.
2. **Application/instance identity** — the names: project, application, environment, EnvironmentType. Identity, not metadata — free-form SCORE `metadata` never enters the context (C6, RFC-002).
3. **The Resource's declaration** — `type`, `class`, `params` (including the `access` block), and requested accesses, schema-validated against the ResourceType.

The parked deployment-target concept (RFC-001 §9) — region, cluster, cloud — will arrive as one more AttributeSource registration under the identical contract.

### R13 — AttributeSource contract

The ResolutionContext is assembled exclusively from registered **AttributeSources**:

- **Registration declares emissions.** A source's registration names the attribute keys it may contribute; registration is admission-validated against AttributeSchemas — extending R9 (RFC-001) to runtime-sourced attributes, which are never "authored" and would otherwise escape admission entirely.
- **Emission outside the declaration is an explainable resolution failure** — never a silent drop. The contract is honest in both directions.
- **Conflicts are errors.** Two sources emitting the same key for one resolution is an explainable failure. There is no precedence mechanism in v1 (RFC-001 §8): silent last-writer-wins would make outcomes depend on source evaluation order, violating principle 5.
- **Provenance is traced.** Every attribute in a serialized ResolutionContext records which source produced it (extending R10) — "why did `region=eu-central` match" is answerable down to the source.
- **Built-ins are sources too.** Environment attributes, instance identity, and the resource's type/class/params/accesses are controller-shipped AttributeSources under the same contract. The future deployment-target plugs in as one more registration — no model reshaping.

### The attribute vocabulary

**AttributeSchema** objects (RFC-001 glossary) declare attribute keys, value types/enums, and the scopes each key may appear on (environment, instance, resource params, matching criteria). Enforcement is at admission (R9): an unknown attribute key is an immediate, explainable rejection, never a constraint that silently fails to match. Realized as its own CRD, with each object declaring a small group of related keys (Q4, RFC-001 — resolved: no monolithic registry object).

## 3. Access and outputs matching

### R7 — Outputs schema, access vocabulary, supported subsets, and coverage policies

- The **ResourceType** declares the **outputs schema** for its kind — the closed set of output keys placeholders may address (e.g. `host`, `port`, `username`, `password` for `postgres`) — optionally refined per `class`.
- The **access vocabulary** on the ResourceType maps each access name to the **subset of output keys it unlocks**. A ResourceBinding contains the union of keys unlocked by the accesses that instance was granted; a placeholder addressing a key that no granted access unlocks fails **explainably** at deployment (SCORE-visible behavior in RFC-002 §5).
- Every **ResourceDefinition** must produce outputs conforming to the outputs schema of the `type` (and `class`, where refined) it realizes — this is what makes implementations substitutable behind a stable intent surface.
- Each ResourceDefinition declares the **subset of accesses** it supports. Full coverage is *not* required by the mechanism — a lightweight dev implementation may legitimately support fewer accesses.
- **Policies** may require coverage per EnvironmentType (e.g. `production` definitions must support the full set; `development` definitions may support only `admin`).
- The Resolver matches requested accesses against supported subsets, and exclusions are explainable: *"definition `cnpg-dev` excluded: does not support access `readonly-replica`."*
- A consumer RBR requesting an access the resolved definition does not support fails **explainably to the requester** — the owner's provisioning is unaffected.

## 4. Cross-application references

References (`id`-set SCORE entries, R1 in RFC-002) are environment-agnostic by construction (R2, RFC-002): the environment dimension is resolved here. Both rules below hang off the EnvironmentType's declared **`defaultReferenceTarget`** property (RFC-001 glossary): *self* for every shipped type except `ephemeral`, whose references target `development` — so no workload ever depends on another PR environment's resources.

### R8 — Cross-EnvironmentType denial (default, overridable)

Because Environments are application-scoped, any cross-application RBR is trivially "cross-environment." The meaningful rule is therefore expressed over **EnvironmentTypes**: by default, an RBR may only target a Resource whose owning instance's EnvironmentType is the requester's type's declared **`defaultReferenceTarget`**. Thus `production` → `production` is permitted subject to approval; `staging` → `production` is denied. Policies may override this per organization. The mechanism supports cross-type references; whether they are allowed is meaning, and therefore the organization's call. Resolution mechanics are R12; the enablement shape is open (Q7, RFC-001).

### R12 — Cross-application reference resolution via EnvironmentType

A reference names an owning application's resource but — deliberately — no environment. The controller resolves the environment dimension as follows:

- **Default:** the reference binds to the owner application's environment whose **EnvironmentType is the requesting instance's type's declared `defaultReferenceTarget`** (*self* for every shipped type except `ephemeral` → `development`) — the same stable hook R8 guards on. This also removes the noisiest ambiguity case: ephemeral environments never target each other's PR environments.
- **No candidate:** the RBR is `Pending: no owner environment of matching type` and resolves automatically when one appears (R3 semantics, RFC-001).
- **Multiple candidates:** EnvironmentType does not uniquely select an environment (an application may run several environments of the same type, e.g. multiple `ephemeral` PR environments). The RBR is pending with an explainable ambiguity (`multiple owner environments of type X`) until a Policy-defined mapping disambiguates. Ambiguity is surfaced, never guessed.
- **Cross-type references** beyond the declared target remain denied by default per R8; enabling them is a Policy concern whose exact shape is open (Q7, RFC-001).

## 5. What Policies can express (consolidated)

Policies constrain resolution and lifecycle without ever becoming context attributes. Across the series, the Policy surface currently comprises: per-EnvironmentType access-coverage requirements (R7); RBR approval automation (R5, RFC-001); reference-target overrides and cross-type mappings (R8, R12, Q7); reference disambiguation mappings (R12); and general matching constraints over the ResolutionContext. "Auto-rollback on failure" is likewise Policy-expressible (R11, RFC-001) rather than hardcoded.
