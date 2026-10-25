# Fresh player drawing state

Original LoadLevel.cs503?505,547?549 and761?763 initializes DrawIsPlayer=IsPlayer for Block, Wall and Ref records. The Web parser initialized only isPlayer and deferred drawIsPlayer until an animation update, causing a possessable ring on a fresh winning-transition frame before the next update.

All three parser record paths now initialize the draw flag immediately. Five fresh-load regressions (first/second/third puzzles,1by1_playerr_flip2 andpossess_first) fail before and pass after; they inspect all blocks before an animation tick. This preserves later possession animation transitions. Source evidence is independently confirmed by the original investigation agent; actual automatic-load frame review remains part of final integrated verification.
