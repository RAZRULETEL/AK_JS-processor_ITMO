(
 (    function    factorial (x   )
                    (if                 (<=   x     1) 1          (* x (factorial (- x 1)))))
 (print (factorial (5)))
)