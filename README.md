# Practica 9 - Generacion manual de codigo y sourcemaps

## Resumen

En esta practica se ha completado el transpiler de Dragon a JavaScript para que no dependa solamente de un generador automatico, sino que pueda recorrer manualmente el AST y generar codigo JavaScript controlando en todo momento la linea y columna que se esta escribiendo.

El objetivo principal es que, si el codigo JavaScript generado falla en tiempo de ejecucion, el programa pueda mostrar tambien la posicion original del error en el fichero `.drg`.

Por ejemplo, en vez de mostrar solo:

```text
At generated code examples/runtime-err02-arrayaccess.drg.js:4:1
```

ahora tambien muestra:

```text
At source examples/runtime-err02-arrayaccess.drg:6:3
At generated code examples/runtime-err02-arrayaccess.drg.js:4:1
```

## Punto de partida

La plantilla ya incluia:

- Un lexer en `src/grammar.l`.
- Una gramatica en `src/grammar.jison`.
- Un CLI en `bin/drg2js.cjs`.
- Helpers de entrada/salida en `src/io-helpers.cjs`.
- Helpers de ejecucion en sandbox en `src/sandbox-helpers.cjs`.
- Tests y ejemplos en `__tests__` y `examples`.

El fichero que estaba pendiente de completar para esta practica era principalmente:

```text
src/codegen.cjs
```

Tambien habia que conectar la generacion del sourcemap con el CLI, la escritura de ficheros y el sandbox.

## Gramaticas usadas

Se han usado los ficheros proporcionados:

```text
src/grammar.l
src/grammar.jison
```

El lexer reconoce tokens como:

- Palabras clave: `if`, `else`, `while`, `do`, `break`, `print`, `true`, `false`.
- Tipos: `int`, `float`, `char`, `bool`.
- Identificadores: `ID`.
- Numeros: `NUM` y `REAL`.
- Strings: `STRING`.
- Operadores: `+`, `-`, `*`, `/`, `!`, `&&`, `||`, `==`, `!=`, `<`, `<=`, `>`, `>=`.

La gramatica construye un AST compatible con Babel/ESTree usando nodos como:

- `Program`
- `BlockStatement`
- `VariableDeclaration`
- `ExpressionStatement`
- `IfStatement`
- `WhileStatement`
- `DoWhileStatement`
- `BreakStatement`
- `AssignmentExpression`
- `BinaryExpression`
- `LogicalExpression`
- `UnaryExpression`
- `MemberExpression`
- `CallExpression`
- `NumericLiteral`
- `BooleanLiteral`
- `StringLiteral`

Cada nodo recibe informacion de localizacion mediante `loc`, usando las posiciones de Jison (`@$`, `@1`, `@2`, etc.). Esa informacion es necesaria para crear los sourcemaps.

## Generacion manual de JavaScript

Se ha implementado `src/codegen.cjs`.

Este fichero contiene un generador manual basado en el patron visitor. La idea es que cada tipo de nodo del AST tiene una funcion encargada de convertirlo a JavaScript.

Ejemplos:

```text
Program              -> emitProgram
BlockStatement       -> emitBlockStatement
VariableDeclaration  -> emitVariableDeclaration
IfStatement          -> emitIfStatement
WhileStatement       -> emitWhileStatement
DoWhileStatement     -> emitDoWhileStatement
CallExpression       -> emitCallExpression
MemberExpression     -> emitMemberExpression
BinaryExpression     -> emitBinaryLikeExpression
LogicalExpression    -> emitBinaryLikeExpression
UnaryExpression      -> emitUnaryExpression
```

Por ejemplo, un nodo:

```js
{
  type: 'WhileStatement',
  test,
  body
}
```

se genera como:

```js
while (test) body
```

La funcion correspondiente escribe:

```js
while (
```

despues genera la condicion, despues escribe:

```js
)
```

y por ultimo genera el cuerpo.

## Clase `Emitter`

La clase `Emitter` se ha creado para centralizar la escritura del codigo generado.

Sus responsabilidades son:

- Guardar los fragmentos de JavaScript generados.
- Mantener la linea actual del fichero generado.
- Mantener la columna actual del fichero generado.
- Gestionar la indentacion.
- Registrar mappings para el sourcemap.

En vez de concatenar codigo directamente con strings, se usa:

```js
emitter.write('while (');
```

Esto permite que cada caracter escrito actualice la posicion actual. Si se escribe un salto de linea, aumenta la linea y la columna vuelve a cero.

## Sourcemaps

Tambien se ha implementado la generacion de sourcemaps.

Un sourcemap relaciona una posicion del codigo generado con una posicion del codigo original.

Cada mapping contiene:

```js
generated: { line, column }
original: { line, column }
source: sourceFile
```

En esta practica:

- `generated` apunta al JavaScript generado.
- `original` apunta al codigo Dragon original.
- `source` es el fichero `.drg`.

Cuando el generador va a emitir codigo correspondiente a un nodo del AST, llama a:

```js
emitter.mark(node);
```

Esa llamada registra la correspondencia entre:

```text
posicion actual en el .js
posicion original del nodo en el .drg
```

Al final, el CLI escribe dos ficheros:

```text
archivo.js
archivo.js.map
```

El JavaScript generado incluye al final:

```js
//# sourceMappingURL=archivo.js.map
```

## Ejecucion en sandbox

El fichero `src/sandbox-helpers.cjs` se ha adaptado para usar el sourcemap cuando hay errores de ejecucion.

El flujo es:

1. El JavaScript generado se ejecuta con `vm.runInNewContext`.
2. Si ocurre un error, Node genera un stack trace con una posicion del `.js`.
3. Se extrae la linea y columna generada usando `extractLocationFromStack`.
4. Se consulta el sourcemap con `originalLocationFor`.
5. Se imprime el error con la posicion original y la posicion generada.

El resultado tiene este formato:

```text
Error: Cannot read properties of undefined (reading '0')
At source examples/runtime-err02-arrayaccess.drg:6:3
At generated code examples/runtime-err02-arrayaccess.drg.js:4:1
```

## Cambios en el CLI

Se ha actualizado `bin/drg2js.cjs` para que trabaje con el nuevo resultado de `generateJavaScript`.

Antes se esperaba solo codigo:

```js
const { code } = generateJavaScript(...);
```

Ahora el generador devuelve:

```js
const { code, map } = generateJavaScript(...);
```

El CLI usa:

- `code` para escribir o ejecutar el JavaScript.
- `map` para escribir el `.js.map`.
- `map` para remapear errores si se usa la opcion `-s`.

## Cambios en la escritura de salida

Se ha actualizado `src/io-helpers.cjs`.

La funcion `writeJsOutput` ahora puede recibir un sourcemap:

```js
writeJsOutput(code, options, map)
```

Si existe `map`, escribe:

```text
salida.js
salida.js.map
```

## Ejemplos de uso

Instalar dependencias:

```bash
npm install
```

Generar el parser desde las gramaticas:

```bash
npm run build
```

Generar JavaScript:

```bash
node bin/drg2js.cjs examples/prac-comp.drg -o tmp/prac-comp.js
```

Generar JavaScript y AST:

```bash
node bin/drg2js.cjs examples/prac-comp.drg -o tmp/prac-comp.js --ast
```

Ejecutar en sandbox:

```bash
node bin/drg2js.cjs examples/bool01.drg -s
```

Probar un error de ejecucion:

```bash
node bin/drg2js.cjs examples/runtime-err02-arrayaccess.drg -s
```

Ejecutar tests en Linux:

```bash
npm test
```

## Ficheros principales modificados

```text
src/grammar.l
src/grammar.jison
src/parser.cjs
src/codegen.cjs
src/sandbox-helpers.cjs
src/io-helpers.cjs
bin/drg2js.cjs
```

## Comprobaciones realizadas

Se comprobo que:

- El parser se genera correctamente con `npm run build`.
- `examples/bool01.drg` se ejecuta y muestra `true`.
- Los errores runtime muestran posicion en el fichero `.drg`.
- Se generan ficheros `.js.map`.
- El codigo generado para `prac-comp.drg` tiene sintaxis JavaScript valida.

Ejemplo comprobado:

```bash
node bin/drg2js.cjs __tests__/fixtures/runtime-err02-arrayaccess.drg -s
```

Salida esperada:

```text
Error: Cannot read properties of undefined (reading '0')
At source __tests__/fixtures/runtime-err02-arrayaccess.drg:6:3
At generated code __tests__/fixtures/runtime-err02-arrayaccess.drg.js:4:1
```

## Conclusion

La practica queda completada porque el compilador:

1. Lee codigo Dragon.
2. Lo convierte en tokens con el lexer.
3. Lo transforma en AST con Jison.
4. Recorre el AST manualmente con un visitor.
5. Genera JavaScript.
6. Genera un sourcemap.
7. Ejecuta el JavaScript en sandbox si se usa `-s`.
8. Traduce errores runtime del JavaScript generado a posiciones del codigo Dragon original.
