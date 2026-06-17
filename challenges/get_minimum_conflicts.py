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
"""


def _inversions_within(s):
    """Numero de inversiones (pares i<j con s[i] > s[j]) dentro de s."""
    freq = [0] * 26
    inversions = 0
    for ch in s:
        c = ord(ch) - 97
        inversions += sum(freq[c + 1:])
        freq[c] += 1
    return inversions


def _prefix_freqs(s):
    """freqs[k] = conteo por letra de s[:k], para k = 0..len(s)."""
    freqs = [[0] * 26]
    current = [0] * 26
    for ch in s:
        current = current[:]
        current[ord(ch) - 97] += 1
        freqs.append(current)
    return freqs


def _suffix_greater_counts(freqs):
    """
    Para cada prefijo k, greater[k][c] = numero de elementos en ese
    prefijo cuyo valor (letra) es estrictamente mayor que c.
    """
    result = []
    for freq in freqs:
        g = [0] * 27
        for c in range(24, -1, -1):
            g[c] = g[c + 1] + freq[c + 1]
        result.append(g)
    return result


def getMinimumConflicts(primary, secondary):
    n, m = len(primary), len(secondary)

    inv_primary = _inversions_within(primary)
    inv_secondary = _inversions_within(secondary)

    freq_primary_prefix = _prefix_freqs(primary)
    freq_secondary_prefix = _prefix_freqs(secondary)

    greater_in_secondary = _suffix_greater_counts(freq_secondary_prefix)
    greater_in_primary = _suffix_greater_counts(freq_primary_prefix)

    # cross[i][j] = minimo numero de conflictos "cruzados" (entre un
    # commit de primary y uno de secondary) al fusionar primary[:i] con
    # secondary[:j], preservando el orden interno de cada rama.
    cross = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        c_p = ord(primary[i - 1]) - 97
        for j in range(1, m + 1):
            c_s = ord(secondary[j - 1]) - 97
            place_primary_last = cross[i - 1][j] + greater_in_secondary[j][c_p]
            place_secondary_last = cross[i][j - 1] + greater_in_primary[i][c_s]
            cross[i][j] = min(place_primary_last, place_secondary_last)

    return inv_primary + inv_secondary + cross[n][m]


if __name__ == '__main__':
    primary = input()
    secondary = input()

    result = getMinimumConflicts(primary, secondary)

    print(result)
