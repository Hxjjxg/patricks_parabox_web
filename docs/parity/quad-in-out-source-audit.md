# Native QuadInOut source audit

Native source: `Assets/Scripts/Assembly-CSharp/Util.cs:16-23`.
It doubles k, returns `.5*k*k` below1, then evaluates
`-.5*((k-=1)*(k-2)-1)`. The assignment mutates k before the second
multiplicand. With j=2*input, the second branch is therefore
`-.5*((j-1)*(j-3)-1)`. Native operation intermediates are float32.

The Web core before main's8835e6c used(j-1)*(j-2), producing.625 at.75
and.5 at1 rather than native.875/1. It had no production callers at the
inspected revision; only the exported definition existed. Renderer
flipShineRendering has its own correctly mutated float32 implementation.
Main owns and committed the core correction; this investigator made no
production animation edits.

Native direct call sites:

| File / lines | Use |
| --- | --- |
| Draw.cs1785 | Trailer ending camera interpolation |
| Draw.cs1871 | Title interpolation |
| Draw.cs3945-3946 | Twice-applied flip shine phase |
| Draw.cs6841 | Show-mode pulse |
| Draw.cs6854 | Show-mode shuffle |
| Draw.cs6915,6918 | Show-mode transition |
| PauseMenu.cs1289 | Language startup offset |
| PauseMenu.cs1304 | Controls menu offset |
| Util.cs40,42 | QuadOscillate helper |
