#!/bin/python3
"""
Pregunta 1 (traduccion al espanol)
-----------------------------------
En Amazon, los desarrolladores quieren fusionar las ramas de control de
versiones "primary" (primaria) y "secondary" (secundaria) en una unica
rama, preservando el orden de los commits de cada rama. Cada caracter de
una rama representa la prioridad de un commit: cuanto menor sea el orden
alfabetico de la letra, mayor es la prioridad de ese commit.

Se produce un conflicto cuando, en la rama fusionada, un commit de menor
prioridad queda colocado antes que un commit de mayor prioridad.

El objetivo es encontrar el numero minimo de conflictos posibles en
cualquier fusion valida de las ramas "primary" y "secondary".

Ejemplo
    primary = "zc"
    secondary = "d"

Hay tres posibles combinaciones de fusion:
    - "zcd" con 2 conflictos ('z', de menor prioridad, se coloca antes
      que los commits de mayor prioridad 'c' y 'd')
    - "zdc" con 3 conflictos
    - "dzc" con 2 conflictos

El numero minimo de conflictos posible es 2.

Descripcion de la funcion
    getMinimumConflicts(primary, secondary)
        string primary: la secuencia de commits de la rama primaria
        string secondary: la secuencia de commits de la rama secundaria

Retorno
    int: el numero minimo de conflictos tras una fusion valida

Restricciones
    1 <= len(primary), len(secondary) <= 1000
    primary y secondary solo contienen letras minusculas del alfabeto ingles.

Nota: no basta con fusionar "tomando siempre el caracter mas pequeno
disponible" (como en un merge sort). Esa estrategia da la fusion mas
pequena lexicograficamente, pero no siempre minimiza el numero de
conflictos (se puede comprobar con un contraejemplo como primary="ba",
secondary="ab"). Por eso se usa programacion dinamica: la decision en
cada paso depende de todo lo que queda por fusionar en ambas ramas.
"""


def _inversions(s):
    """Numero de pares i<j con s[i] > s[j] dentro de una misma cadena."""
    freq = [0] * 26
    total = 0
    for ch in s:
        c = ord(ch) - 97
        total += sum(freq[c + 1:])
        freq[c] += 1
    return total


def getMinimumConflicts(primary, secondary):
    n, m = len(primary), len(secondary)

    # countP[i] / countS[j]: cuantas veces aparece cada letra en el
    # prefijo primary[:i] / secondary[:j].
    countP = [[0] * 26]
    for ch in primary:
        countP.append(countP[-1][:])
        countP[-1][ord(ch) - 97] += 1

    countS = [[0] * 26]
    for ch in secondary:
        countS.append(countS[-1][:])
        countS[-1][ord(ch) - 97] += 1

    # dp[i][j]: minimo de conflictos "cruzados" (uno de cada rama) al
    # fusionar primary[:i] con secondary[:j].
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        cp = ord(primary[i - 1]) - 97
        for j in range(1, m + 1):
            cs = ord(secondary[j - 1]) - 97
            dp[i][j] = min(
                dp[i - 1][j] + sum(countS[j][cp + 1:]),   # primary[i-1] va de ultimo
                dp[i][j - 1] + sum(countP[i][cs + 1:]),   # secondary[j-1] va de ultimo
            )

    return _inversions(primary) + _inversions(secondary) + dp[n][m]


if __name__ == '__main__':
    primary = input()
    secondary = input()

    result = getMinimumConflicts(primary, secondary)

    print(result)
