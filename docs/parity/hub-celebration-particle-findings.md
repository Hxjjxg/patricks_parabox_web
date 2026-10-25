# Hub celebration edge particles

2026-10-25. Source-only implementation of Particle.SpawnCelebrationEdgeParticles and CreateCelebrationEdgeParticle. Recovered source: F:/AssetRipper_win_x64/parabox/ExportedProject/Assets/Scripts/Assembly-CSharp/Particle.cs424–486. Only three new files belong to this task: src/core/hubCelebrationParticles.ts, tests/hubCelebrationParticles.test.ts, and this finding. No existing production file, native executable/DLL/save, UI, git index, or prior evidence was changed.

## Export and ownership

spawnHubCelebrationEdgeParticles(level, random=Math.random) returns void and appends to the supplied actual model Level.particles array using the actual Particle interface. It does not clear existing particles, inspect grid dimensions, select random sides, modify side bookkeeping, move particles, or schedule the celebration. Every emitted object is distinct.

Source count is four stations, four edges per station, **16 particles total**. Station coordinates are -.375, -.125, .125, .375, from float ((i+.5f)/4f)-.5f. Within each station the append order is **+Y, -Y, +X, -X**. Each particle is appended before any of its four random samples, matching source creation timing.

## Source properties and random order

All four edges use size=.05f, distance=.5f+(.05f*.3f), shrink range [-.09f,-.045f], tangent speed range [-.22f,.22f], and slowDown=.985f. There is no portal-particle .8 size multiplier here.

| Edge | Position | Velocity | Four random calls, in order |
| --- | --- | --- | --- |
| +Y | (station+jitter,+distance) | (tangent,-inwardY) | jitter, shrink, deltaX, inwardY magnitude |
| -Y | (station+jitter,-distance) | (tangent,+inwardY) | jitter, shrink, deltaX, inwardY magnitude |
| +X | (+distance,station+jitter) | (-inwardX,tangent) | jitter, shrink, inwardX magnitude, deltaY |
| -X | (-distance,station+jitter) | (+inwardX,tangent) | jitter, shrink, inwardX magnitude, deltaY |

Jitter range is [-.05f,.05f]. Y inward magnitude range is [.35f*.2f,.35f]; X inward magnitude range is [.35f*.3f,.35f]. The source X/Y minimum speeds are deliberately different. There are exactly **64 range calls / injected unit samples**, without retries or extra color samples.

CreateCelebrationEdgeParticle assigns hue=0,sat=0,val=1; Draw.neutralColor with alpha replaced by .4f; matching hueStart/satStart/valStart; celebration=true. Draw.cs310 defines raw neutral RGBA=(.5f,.5f,.5f,.5f). The existing model represents current HSV plus alpha rather than a separate raw GUI Color/start-HSV object, so generated particles use hue0/sat0/val1, alpha=.4f, celebration=true. No new model fields or renderer conversion were introduced.

## Precision and RNG boundary

C# float literals and source arithmetic are rounded through Math.fround. Examples of source-derived IEEE values: distance=.5149999856948853, size=.05000000074505806, slowDown=.9850000143051147, alpha=.4000000059604645. In particular .35f*.3f rounds to .10500000417232513; replacing it with the independent literal .105f would produce a different float.

The injected callback supplies normalized unit values, one per native Random.Range call. The adapter maps each sample with float32 min+(max-min)*sample, preserving source bounds and call order. Endpoint samples0 and1 are supported. This is an explicit deterministic adapter contract: Unity's internal PRNG and its native Range interpolation implementation were not recovered or observed here. The default Math.random sequence is not claimed to match Unity's random sequence or seed. Tests establish source mechanisms and this adapter's arithmetic, not captured Unity random-value/ULP equivalence. No fitted constants, scaled screenshots, or invented native measurements were used.

## Integration ordering and rendering boundaries

World.cs1116 runs Particle.Update before World1249 spawns the completion edge burst. **New edge particles are not moved on their birth update.** Consume the completed celebration clock's edge-burst event after that update's existing particle advance; generating before the general particle update would advance them prematurely.

Draw.cs5689 excludes celebration particles from the ordinary particle pass. Draw6080–6112 draws them in a separate later Hub-only pass, with clamp set to the level rect and then restored to the ticket clamp. Generation does not implement that draw ordering or clipping. Main owns renderer integration; current ordinary-pass placement is not evidence of visual parity.

The completed clock event must keep its attached level long enough to pass it to this function before clearing the reference. Burst generation is separate from portal-by-portal pops, which call SpawnParticlePortal three times and have different size/motion rules.

## Validation and approval

Nine deterministic tests pass. They cover count and append preservation; distinct object identity; station/edge order; HSV/alpha/size/damping; float32 values; exact four-sample property mapping; both inclusive endpoint fixtures; append-before-random and field assignment timing; dimensions/side bookkeeping independence; and default Math.random consumption. TypeScript typecheck passes.

No native process was launched, deployed, interacted with, or captured. There is **no new native visual approval**. Motion integration, random-engine equivalence, renderer pass/clamp behavior, and final source/native/Web visual comparison remain separate responsibilities; prior rejected black captures remain rejected.
