# Native face rendering

Draw.cs DrawFace3952 onward uses actual EyeOpen / EyeClosed / PossessEye textures, with the corresponding small variant selected after the blink width scale. Blink changes width by1.05 and height by0.95; it does not collapse an open-eye texture into a horizontal bar. Native eye dimensions are 0.2 of the block dimensions with no minimum-size floor.

All normal player and possessable eyes use the same black direct Color alpha. The GUI shader doubles this direct alpha, unlike colors passed through HSVToRGBGUI. Possessable eye geometry is the same centerY minus0.05height as player eyes and follows the same allowed look offsets. The renderer now shares that path, including source float arithmetic and SetDrawRect endpoint truncation. Eye mirroring uses the parent ticket parity, not the block's own FlipH.

Six actual drawFace regressions failed before the change, then all passed. The combined face/recursion/block run passed13 tests and typecheck. Native GPU eye PNGs are independently locked by the auxiliary texture manifest. These changes await fresh PNG acceptance. Multi-player mouth textures, cloneFade ticket blending, HubTransitionEyesJumpingIn and the special infPossessableHack are separate remaining work.
