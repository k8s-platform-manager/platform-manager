# Platform Manager

An open-source **platform controller** that resolves application intent, expressed as [SCORE](https://score.dev) workload specifications, into provisioned infrastructure without embedding organizational semantics into the controller itself.

## What problem does this solve?

Platform controllers tend to accrete organization-specific logic over time: naming conventions, resource wiring, approval rules, and infrastructure assumptions all end up baked into the controller. Platform Manager is built around a strict separation of concerns between three parties:

- **The controller** (this project) provides *mechanism*: matching, resolution, reconciliation, provisioning orchestration, and explainability. It never embeds organizational semantics.
- **The platform team** provides *meaning*: organizational vocabulary, policies, resource definitions, and provisioning wiring for their organization.
- **The application team** provides *intent*: SCORE workload specifications and resource declarations expressed in the organization's own vocabulary.

Every entity in the domain model is owned by exactly one of these parties, and the controller's job is to resolve declared intent into infrastructure by constraint-matching against platform-team-defined rules — never by inventing infrastructure or hard-coding what a resource, environment, or policy should mean.

## Design principles

1. **Separate mechanism from meaning.** The controller matches, resolves, reconciles, and explains. Organizations define vocabulary, attributes, policies, implementations, and provisioning logic.
2. **Intent before infrastructure.** Applications express intent; organizations define how intent maps onto infrastructure; infrastructure details stay implementation details.
3. **Explainability is first-class.** Every resolution outcome — success, failure, pending — is traceable: why an implementation matched, why others didn't, and what context was used.
4. **Constraint solving over inheritance.** Resolution is attribute/constraint-based, not hierarchy-based. The resolver never invents infrastructure; provisioning is a separate, downstream concern.
5. **Order independence.** The system is level-triggered and reconciling — no rule depends on the order in which objects are applied.

## Documentation

Full documentation, including the domain model and design rationale, lives in [`docs/`](docs) and is published via GitHub Pages. Design proposals are tracked as Requests for Comments — start with [RFC 0001: Platform Controller Domain Model](docs/src/content/docs/rfcs/rfc0001-platform-controller-domain-model.md), which defines the entities, relationships, and ownership boundaries this project is built on.

To run the docs site locally:

```bash
cd docs
npm install
npm run dev
```

See [docs/README.md](docs/README.md) for more.
