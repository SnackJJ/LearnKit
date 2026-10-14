# Math Rendering Test Cards

Copy this note into your vault and open it in the reviewer (main study view).
Each card covers a different math pattern from the GitHub reports. Verify that
every `$...$`, `$$...$$`, `\(...\)`, and `\[...\]` block renders as math, that
no `|` or `\` leaks into the visible text, and that no field gets truncated.

---

## 1. Inline math

^learnkit-900000001
T | Inline math |
Q | What is the derivative of $x^2$? |
A | The derivative is $2x$. |

---

## 2. Fraction and Greek letters

^learnkit-900000002
T | Fraction and Greek |
Q | Simplify $\frac{a}{b} + \frac{c}{d}$. |
A | $\frac{ad + bc}{bd}$ |

---

## 3. Single-line display math

^learnkit-900000003
T | Single-line display |
Q | Evaluate $$\int_0^1 x^2 \, dx$$ |
A | $$\frac{1}{3}$$ |

---

## 4. Alternative delimiters \( \) and \[ \]

^learnkit-900000004
T | Alternative delimiters |
Q | The quadratic formula is \(x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}\). What is the discriminant? |
A | The discriminant is \[b^2 - 4ac\]. |

---

## 5. Multi-line aligned block with row breaks

^learnkit-900000005
T | Multiline aligned |
Q | Solve for $x$:
$$
\begin{aligned}
2x + 3 &= 7 \\
2x &= 4 \\
x &= 2
\end{aligned}
$$ |
A | $x = 2$ |

---

## 6. Matrix (bmatrix)

^learnkit-900000006
T | Matrix bmatrix |
Q | Find the determinant of
$$
\begin{bmatrix}
1 & 2 \\
3 & 4
\end{bmatrix}
$$ |
A | $-2$ |

---

## 7. Determinant (vmatrix)

^learnkit-900000007
T | Determinant vmatrix |
Q | Compute
$$
\begin{vmatrix}
1 & 2 \\
3 & 4
\end{vmatrix}
$$ |
A | $-2$ |

---

## 8. Norm bars — raw `|` inside multi-line display math

This is the core issue: a bare `|` at the end of a line inside `$$...$$` must
not be treated as the field terminator.

^learnkit-900000008
T | Norm bars raw |
Q | Compute the norm:
$$
\left| x \right|
$$
where $x$ is a vector. |
A | $\left| x \right| = \sqrt{x \cdot x}$ |

---

## 9. Escaped norm bars (write-side round-trip form)

^learnkit-900000009
T | Norm bars escaped |
Q | The Euclidean norm is $\|x\| = \sqrt{\sum x_i^2}$. |
A | Correct. |

---

## 10. Angle brackets — literal `<` and `>`

^learnkit-900000010
T | Angle brackets |
Q | Is it always true that $x < y$ when $x > 0$? |
A | No, for example $3 < 2$ is false. |

---

## 11. Inner product with \langle and \rangle

^learnkit-900000011
T | Inner product |
Q | Express the inner product of $u$ and $v$ in $\mathbb{R}^n$. |
A | $\langle u, v \rangle = \sum_{i=1}^{n} u_i v_i$ |

---

## 12. Cloze with math

^learnkit-900000012
T | Cloze with math |
CQ | The derivative of {{c1::$x^2$}} is {{c2::$2x$}}. |

---

## 13. MCQ with math in stem and options

^learnkit-900000013
T | MCQ with math |
MCQ | Which is the correct derivative of $x^3$? |
A | $3x^2$ |
O | $x^2$ |
O | $3x$ |
O | $3x^3$ |

---

## 14. Mixed: multiple inline blocks plus text

^learnkit-900000014
T | Mixed inline |
Q | Given $v = u + at$ and $s = ut + \frac{1}{2}at^2$, express $v^2$ in terms of $u$, $a$ and $s$. |
A | $v^2 = u^2 + 2as$ |

---

## 15. Piecewise function (cases)

^learnkit-900000015
T | Piecewise cases |
Q | Define the absolute value function.
$$
|x| =
\begin{cases}
x & x \geq 0 \\
-x & x < 0
\end{cases}
$$ |
A | This is a piecewise definition. |

---

## 16. Subscripts and superscripts

^learnkit-900000016
T | Subscripts superscripts |
Q | In $E = mc^2$, what does $m$ represent, and what is $m_0$? |
A | $m$ is mass; $m_0$ is rest mass. |

---

## 17. Summation notation

^learnkit-900000017
T | Summation |
Q | Evaluate $$\sum_{i=1}^{n} i$$ |
A | $$\frac{n(n+1)}{2}$$ |

---

## 18. Square roots and limits

^learnkit-900000018
T | Roots and limits |
Q | Evaluate $$\lim_{x \to 0} \frac{\sin x}{x}$$ |
A | $1$ |

---

## 19. Literal dollar amounts (must NOT render as math)

^learnkit-900000019
T | Dollar amounts |
Q | If an item costs $5 and you pay $10, what is your change? |
A | $5 |

---

## 20. Ordered question with math steps

^learnkit-900000020
T | OQ with math |
OQ | Order the steps to solve $2x + 3 = 7$. |
1 | Subtract 3 from both sides: $2x = 4$. |
2 | Divide both sides by 2: $x = 2$. |

---

## 21. Backslash-heavy commands round-trip

^learnkit-900000021
T | Backslash commands |
Q | Simplify $\begin{pmatrix} a & b \\ c & d \end{pmatrix}$ when $a=d$ and $b=c=0$. |
A | $a \cdot I$, the scalar multiple of the identity matrix. |
