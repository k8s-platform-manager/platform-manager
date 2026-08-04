---
title: "RFC-002: The SCORE Profile"
description: How SCORE workload specifications are interpreted by the platform controller — resource ownership, identity, ids and aliases, params, placeholders, and metadata handling.
---

| | |
|---|---|
| **Status** | Draft for review |
| **Series** | [RFC-001: Domain Model & Ownership Boundaries](rfc-001-domain-model-and-ownership.md) · RFC-002 (this document) · [RFC-003: Resolution & the Attribute Model](rfc-003-resolution-and-attribute-model.md) |
| **Scope** | How SCORE workload specifications are interpreted by the platform controller: resource ownership, identity, ids and aliases, params, placeholders, and metadata handling |
| **Audience** | Application teams authoring SCORE files; implementers of the SCORE translation layer |
| **Upstream** | [SCORE specification](https://docs.score.dev/docs/score-specification/score-spec-reference/), `score.dev/v1b1` |
| **Date** | 2026-08-04 (split from the 2026-08-03 combined RFC) |

> **Series conventions.** Rule and caveat numbers are global across the series; this document holds **R1, R2, C1, and C6**. Entities used here (Project, Application, Resource, ResourceType, ResourceBinding, …) are defined in the RFC-001 glossary. The decision log (rejected ideas, open questions) lives in RFC-001 §8/§10.

---

## 1. Purpose and stance

SCORE compliance is a **stated priority** of this project: SCORE files valid for this controller are syntactically valid upstream SCORE, and upstream semantics are adopted wherever they exist. This document specifies the one place where the controller *profiles* SCORE (C1) and the small, explicit set of metadata keys it interprets (C6). Everything not named here is SCORE-owned and opaque to the domain model.

## 2. The SCORE surface, partitioned

| SCORE concept | Status in this profile |
|---|---|
| `resources.*.type`, `class`, `id` | Resource identity, verbatim upstream semantics (R1) |
| `resources.*.params` | Provisioning configuration (owner) or access configuration (reference) — R1 |
| `resources.*.metadata` | Opaque pass-through, except controller-prefixed annotations (C6); carries the human alias (R2) |
| `metadata` (workload level) | Opaque pass-through, except `metadata.project` (R2, C6) |
| `${resources.<key>}` / `${resources.<key>.<output>}` | Placeholder resolution (§5) |
| `containers`, `service`, `apiVersion` | **SCORE-owned.** Opaque to the domain model; handed to the workload runtime (RFC-001 §9, deployment target). `apiVersion` support is pinned to `score.dev/v1b1`. |

## 3. Core rules

### R1 — Resource ownership via the `id` presence rule

Resource identity follows upstream SCORE verbatim: two declarations denote the same resource iff **`type`, `class`, and `id` all match**. `class` values are vocabulary: each ResourceType declares its legal classes, and an unknown class is an explainable admission rejection (consistent with R9, RFC-001) rather than a criterion that silently never matches. `class` participates in identity and matching but is never encoded into the `id` string itself.

A SCORE resource entry is interpreted as follows:

| SCORE declaration | Interpretation |
|---|---|
| `type` (± `class`), **no** `id` | The declaring ApplicationInstance is the **owner**. Triggers provisioning. `params` are provisioning configuration, validated against the ResourceType's parameter schema. The controller generates the deterministic `id` (R2). |
| `type` (± `class`) **and** `id` | A **reference** to a resource owned elsewhere — an `id`-set entry never provisions (see C1). Triggers a **ResourceBindingRequest** by the declaring instance. |
| … with `params` on a reference | **Access configuration.** Requested accesses and their per-access configuration are expressed under the well-known params key `access`, whose per-access value schemas are declared by the ResourceType (the key is controller-owned mechanism; the shapes are vocabulary — the C2 duality, RFC-001). Params on a reference outside the access-configuration schema are an **explainable rejection**: a consumer still may not reshape a resource it does not own — the tripwire is schema-based rather than syntax-based. |

### R2 — Deterministic project-qualified ids, environment-agnostic references, and human aliases

Because the owner may never choose the id (absence of `id` *is* the ownership signal), consumers must still be able to know it. Therefore:

- Every Application belongs to exactly one **Project**, declared via the workload's `metadata.project` field — a controller-interpreted metadata key (see C6) — defaulting to the controller-shipped `default` Project. Membership is optional to author; ids are uniformly qualified regardless.
- The controller generates the `id` **deterministically**: `<project>.<application>.<resource-key>` — predictable from information a consumer already has, and collision-free across the organization. (A future standalone, application-less resource identifies naturally as `<project>.<resource-key>` — see Q8, RFC-001.)
- The `id` is deliberately **environment-agnostic**: the SCORE spec defines the resources section as environment-agnostic, so no environment segment may ever appear in an authored file. The environment dimension is resolved by the controller at materialization (R12, RFC-003), yielding the **canonical internal identity** `(environment × type × class × id)`.
- The owner may additionally declare a **human alias** in the resource's SCORE `metadata`, which the controller registers as an equivalent reference. The alias protects consumers from breakage if the owning Application is renamed **or moved between Projects** — a Project move is an identity change, not a free operation — failures the deterministic scheme alone would not survive.
- A bare placeholder `${resources.<key>}` resolves to the resource's canonical id, per the SCORE spec's resource-id reference semantics.
- The canonical identity and alias are both recorded in the Resource's status.

## 4. Caveats

**C1 — One narrow semantic profile over SCORE.** This model adopts upstream SCORE semantics wherever they exist: resource identity is the (`type`, `class`, `id`) triple, references are environment-agnostic, bare placeholders return the resource id, and params may configure references. A single deliberate divergence remains: upstream, the *first workload to define* a (type, class, id) becomes its de-facto definer (first-writer-wins — e.g. metadata references on shared resources come from "the workload that first defined the resource"); here, **an `id`-set entry references and never provisions** — only the no-`id` declarer is the owner. This asymmetry is what makes protected ownership (R4), universal RBRs (R5), and blast-radius semantics (R6) — all RFC-001 — possible, and it is stated here so nobody discovers it in production.

**C6 — Metadata never reaches the resolver.** Everything the Resolver sees is vocabulary-validated at admission (R9, RFC-001); SCORE `metadata` — workload-level or resource-level — is by definition free-form and never vocabulary-validated, so it never enters the ResolutionContext. Matching inputs flow only through validated channels: environment attributes, application/instance identity, and the resource's `type`/`class`/`params`. Metadata is opaque pass-through to the destination runtime, as the SCORE spec intends — with two profile exceptions, both explicit: **controller-prefixed resource annotations** (currently only the R2 alias) and the workload-level **`metadata.project`** membership field (R2) are interpreted and validated by the controller. All other metadata keys pass through untouched and can never influence resolution.

## 5. Placeholder resolution

The controller resolves SCORE `${…}` placeholders as follows (the vocabulary machinery behind this — outputs schemas and access-to-output-key mapping — is R7, RFC-003):

- **Bare resource reference** `${resources.<key>}` → the resource's **canonical id** (R2), per the spec's resource-id reference semantics.
- **Output reference** `${resources.<key>.<output>}` → the named output key from the instance's **ResourceBinding** for that resource. The binding contains the union of output keys unlocked by the accesses the instance was granted; a placeholder addressing a key that no granted access unlocks **fails explainably** at deployment (R7, RFC-003).
- **Workload metadata reference** `${metadata.<key>…}` → resolved from the declaring workload's metadata, upstream semantics. Note this is pure interpolation into container variables/files/params — it does not put metadata into the ResolutionContext (C6).
- **Placeholders in `resources.*.params`** are supported per the spec, including references to other resources' outputs within the same workload — resources are evaluated as an acyclic graph, upstream semantics.

Output shapes are stable per ResourceType (optionally refined per class): every ResourceDefinition realizing a type must produce outputs conforming to that type's outputs schema (R7, RFC-003), which is what makes `${resources.db.host}` mean the same thing whether the environment resolved to CloudNativePG or RDS.

## 6. Terminology mapping (for Humanitec migrants)

| This series | Humanitec | SCORE | Notes |
|---|---|---|---|
| Application | Application | Workload (one spec file) | One Application = exactly one SCORE workload (RFC-001 §8). |
| ApplicationInstance | (Application + Environment, combined) | — | The *term* is ours; the *split* it encodes (env-independent definition vs env-scoped materialization) matches Humanitec's Application/Environment structure. |
| Deployment | Deployment | — | Aligned concept and name: an event with status applying a revision to an environment. |
| Environment | Environment | — | Application-scoped in both models. |
| Resource | Resource | `resources` entry | See caveat C1: our owner/consumer semantics are a narrow profile over SCORE. |
| ResourceType | Resource Type | `type` + `class` fields | `class` values are vocabulary entries declared on the type (R1). |
| ResourceDefinition | Resource Definition | — | Deliberately identical naming. |
| ResourceDriver | Resource Driver | — | Deliberately identical naming: the executor, not the matching unit. Earlier drafts of this model inverted these two terms; the inversion was corrected precisely to avoid confusing Humanitec migrants. |
| ResourceBinding / RBR | (no direct equivalent) | — | Novel to this model. |
| Project | (no direct equivalent; roughly an Org grouping) | `metadata.project` (profile-interpreted, R2/C6) | Membership defaults to the shipped `default` Project; provides the id prefix. |
