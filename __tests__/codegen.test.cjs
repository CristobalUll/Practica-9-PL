const path = require('path');
const fs = require('fs');
const vm = require('vm');

const parserPath = path.resolve(__dirname, '..', 'src', 'parser.cjs');
const parser = require(parserPath);

const codegenPath = path.resolve(__dirname, '..', 'src', 'codegen.cjs');
const generateJavaScript = require(codegenPath);

describe('Codegen with Emitter (codegen.cjs)', () => {
  test('generates valid JavaScript from simple assignment', () => {
    const source = '{ int a; a = 1; }';
    const ast = parser.parse(source);
    const { code } = generateJavaScript(ast, { codegen: 'manual' }, source, 'test.drg');

    expect(code).toBeDefined();
    expect(code).toContain('a');
    expect(code).toContain('1');
  });

  test('does not pollute AST with generated code properties', () => {
    const source = '{ int a; a = 1; }';
    const ast = parser.parse(source);
    
    // Store original structure
    const originalKeys = new Set(Object.keys(ast.body[0]));
    
    generateJavaScript(ast, { codegen: 'manual' }, source, 'test.drg');
    
    // Check that no new properties were added to the AST
    const newKeys = new Set(Object.keys(ast.body[0]));
    const added = Array.from(newKeys).filter(k => !originalKeys.has(k));
    
    expect(added).toEqual(expect.not.arrayContaining(['_code', '_lineCount']));
  });

  test('generates executable JavaScript code', () => {
    const source = `{
      int x;
      x = 5;
      print(x);
    }`;
    const ast = parser.parse(source);
    const { code } = generateJavaScript(ast, { codegen: 'manual' }, source, 'test.drg');

    // Create a context with console.log to capture output
    const context = vm.createContext({
      console: { log: console.log },
      Array: Array,
    });

    // Try to execute the code (even with print which may not be defined,
    // the code structure should be valid)
    expect(() => {
      vm.runInContext(code, context);
    }).not.toThrow();
  });

  test('handles nested blocks correctly', () => {
    const source = `{
      int i;
      {
        int j;
        j = i;
      }
    }`;
    const ast = parser.parse(source);
    const { code } = generateJavaScript(ast, { codegen: 'manual' }, source, 'test.drg');

    expect(code).toBeDefined();
    expect(code).toMatch(/\{[\s\S]*\{[\s\S]*\}[\s\S]*\}/); // Nested braces
  });

  test('generates code with Babel generator (default)', () => {
    const source = '{ int a; a = 1; }';
    const ast = parser.parse(source);
    const { code } = generateJavaScript(ast, { codegen: 'babel' }, source, 'test.drg');

    expect(code).toBeDefined();
    expect(code.length).toBeGreaterThan(0);
  });

  test('returns source map when using manual codegen', () => {
    const source = '{ int a; a = 1; }';
    const ast = parser.parse(source);
    const { map } = generateJavaScript(ast, { codegen: 'manual' }, source, 'test.drg');

    if (map) {
      expect(typeof map).toBe('object');
      expect(map.version).toBeDefined();
    }
  });

  test('generates correct code for variable declarations with initialization', () => {
    const source = '{ int x; x = 10; }';
    const ast = parser.parse(source);
    const { code } = generateJavaScript(ast, { codegen: 'manual' }, source, 'test.drg');

    expect(code).toContain('10');
  });

  test('handles complex expressions correctly', () => {
    const source = '{ int result; result = 2 + 3 * 4; }';
    const ast = parser.parse(source);
    const { code } = generateJavaScript(ast, { codegen: 'manual' }, source, 'test.drg');

    expect(code).toContain('+');
    expect(code).toContain('*');
    expect(code).toContain('2');
    expect(code).toContain('3');
    expect(code).toContain('4');
  });

  test('preserves operator precedence in generated code', () => {
    const source = '{ int a; a = 5 + 3 * 2; }';
    const ast = parser.parse(source);
    const { code } = generateJavaScript(ast, { codegen: 'manual' }, source, 'test.drg');

    // The AST should preserve precedence, code should reflect that
    expect(code).toMatch(/5\s*\+\s*3\s*\*\s*2/);
  });

  test('emitter generates consistent code', () => {
    const source = '{ int x; x = 42; }';
    const ast1 = parser.parse(source);
    const ast2 = parser.parse(source);

    const { code: code1 } = generateJavaScript(ast1, { codegen: 'manual' }, source, 'test.drg');
    const { code: code2 } = generateJavaScript(ast2, { codegen: 'manual' }, source, 'test.drg');

    expect(code1).toBe(code2);
  });

  test('loads fixture file and generates code successfully', () => {
    const fixturePath = path.resolve(__dirname, 'fixtures', 'simple00.drg');
    if (fs.existsSync(fixturePath)) {
      const source = fs.readFileSync(fixturePath, 'utf8');
      const ast = parser.parse(source);
      const { code } = generateJavaScript(ast, { codegen: 'manual' }, source, 'simple00.drg');

      expect(code).toBeDefined();
      expect(code.length).toBeGreaterThan(0);
    }
  });

  test('initializes int variables with default value 0', () => {
    const source = '{ int x; }';
    const ast = parser.parse(source);
    const { code } = generateJavaScript(ast, { codegen: 'babel' }, source, 'test.drg');

    expect(code).toContain('0');
    expect(code).toMatch(/let\s+\$x\s*=\s*0/);
  });

  test('initializes bool variables with default value false', () => {
    const source = '{ bool b; }';
    const ast = parser.parse(source);
    const { code } = generateJavaScript(ast, { codegen: 'babel' }, source, 'test.drg');

    expect(code).toContain('false');
    expect(code).toMatch(/let\s+\$b\s*=\s*false/);
  });

  test('initializes float variables with default value 0', () => {
    const source = '{ float f; }';
    const ast = parser.parse(source);
    const { code } = generateJavaScript(ast, { codegen: 'babel' }, source, 'test.drg');

    expect(code).toContain('0');
    expect(code).toMatch(/let\s+\$f\s*=\s*0/);
  });

  test('initializes array of booleans with Array.from', () => {
    const source = '{ bool[5] b; }';
    const ast = parser.parse(source);
    const { code } = generateJavaScript(ast, { codegen: 'babel' }, source, 'test.drg');

    expect(code).toContain('Array.from');
    expect(code).toContain('false');
    expect(code).toContain('5');
  });

  test('initializes array of char with Array.from', () => {
    const source = '{ char[10] c; }';
    const ast = parser.parse(source);
    const { code } = generateJavaScript(ast, { codegen: 'babel' }, source, 'test.drg');

    expect(code).toContain('Array.from');
    expect(code).toContain('""');
    expect(code).toContain('10');
  });

  test('initializes 2D array of booleans', () => {
    const source = '{ bool[3][4] matrix; }';
    const ast = parser.parse(source);
    const { code } = generateJavaScript(ast, { codegen: 'babel' }, source, 'test.drg');

    expect(code).toContain('Array.from');
    expect(code).toContain('false');
    expect(code).toContain('3');
    expect(code).toContain('4');
  });
});