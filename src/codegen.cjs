/*
JavaScript code generation using a manual visitor and a source map.
*/

const path = require('path');
const { SourceMapGenerator } = loadSourceMapPackage();

function loadSourceMapPackage() {
  try {
    return require('source-map');
  } catch (_err) {
    return require('source-map-support/node_modules/source-map');
  }
}

const BINARY_PRECEDENCE = {
  '||': 2,
  '&&': 3,
  '==': 4,
  '!=': 4,
  '<': 5,
  '<=': 5,
  '>': 5,
  '>=': 5,
  '+': 6,
  '-': 6,
  '*': 7,
  '/': 7,
};

class Emitter {
  constructor(sourceFile = '', source = '') {
    this.parts = [];
    this.line = 1;
    this.column = 0;
    this.indentLevel = 0;
    this.indentText = '  ';
    this.sourceFile = sourceFile;
    this.nodeCode = new WeakMap();
    this.nodeMappings = new WeakMap();
    this.map = new SourceMapGenerator({ file: sourceFile ? `${sourceFile}.js` : undefined });

    if (sourceFile && source) {
      this.map.setSourceContent(sourceFile, source);
    }
  }

  write(text) {
    const chunk = String(text);
    this.parts.push(chunk);

    for (const char of chunk) {
      if (char === '\n') {
        this.line += 1;
        this.column = 0;
      } else {
        this.column += 1;
      }
    }
  }

  newline() {
    this.write('\n');
  }

  writeIndent() {
    this.write(this.indentText.repeat(this.indentLevel));
  }

  mark(node) {
    if (!this.sourceFile || !node || !node.loc || !node.loc.start) return;

    const mapping = {
      source: this.sourceFile,
      original: {
        line: node.loc.start.line,
        column: node.loc.start.column,
      },
      generated: {
        line: this.line,
        column: this.column,
      },
    };

    this.map.addMapping(mapping);
    this.nodeMappings.set(node, mapping);
  }

  setCode(node, code) {
    if (node) this.nodeCode.set(node, code);
  }

  getCode(node) {
    return this.nodeCode.get(node);
  }

  getSourceMap() {
    return JSON.parse(this.map.toString());
  }

  toString() {
    return this.parts.join('');
  }
}

function generateJavaScript(ast, options = {}, source = '', sourceFile = '') {
  const emitter = new Emitter(sourceFile, source);

  emitProgram(ast, emitter);

  const map = emitter.getSourceMap();
  const code = addSourceMapComment(emitter.toString(), options.output);

  return { code, map };
}

function addSourceMapComment(code, outputFile) {
  if (!outputFile) return code;
  return `${code}\n//# sourceMappingURL=${path.basename(outputFile)}.map;`;
}

function emitProgram(node, emitter) {
  node.body.forEach((statement, index) => {
    if (index > 0) emitter.newline();
    emitStatement(statement, emitter);
  });
}

function emitStatement(node, emitter) {
  switch (node.type) {
    case 'BlockStatement':
      emitBlockStatement(node, emitter);
      break;
    case 'VariableDeclaration':
      emitIndentedStatement(node, emitter, () => emitVariableDeclaration(node, emitter));
      break;
    case 'ExpressionStatement':
      emitIndentedStatement(node, emitter, () => {
        emitExpression(node.expression, emitter);
        emitter.write(';');
      });
      break;
    case 'IfStatement':
      emitIndentedStatement(node, emitter, () => emitIfStatement(node, emitter));
      break;
    case 'WhileStatement':
      emitIndentedStatement(node, emitter, () => emitWhileStatement(node, emitter));
      break;
    case 'DoWhileStatement':
      emitIndentedStatement(node, emitter, () => emitDoWhileStatement(node, emitter));
      break;
    case 'BreakStatement':
      emitIndentedStatement(node, emitter, () => emitter.write('break;'));
      break;
    case 'EmptyStatement':
      emitIndentedStatement(node, emitter, () => emitter.write(';'));
      break;
    default:
      throw new Error(`Unsupported statement node: ${node.type}`);
  }
}

function emitIndentedStatement(node, emitter, emitContent) {
  emitter.writeIndent();
  emitter.mark(node);
  emitContent();
  emitter.newline();
}

function emitBlockStatement(node, emitter) {
  emitter.mark(node);
  emitter.write('{');

  if (!node.body || node.body.length === 0) {
    emitter.write('}');
    return;
  }

  emitter.newline();
  emitter.indentLevel += 1;
  node.body.forEach((statement) => emitStatement(statement, emitter));
  emitter.indentLevel -= 1;
  emitter.writeIndent();
  emitter.write('}');
}

function emitVariableDeclaration(node, emitter) {
  const declaration = node.declarations[0];

  emitter.write(`${node.kind} `);
  emitExpression(declaration.id, emitter);

  if (declaration.init) {
    emitter.write(' = ');
    emitExpression(declaration.init, emitter);
  }

  emitter.write(';');
}

function emitIfStatement(node, emitter) {
  emitter.write('if (');
  emitExpression(node.test, emitter);
  emitter.write(') ');
  emitStatementBody(node.consequent, emitter);

  if (node.alternate) {
    emitter.write(' else ');
    emitStatementBody(node.alternate, emitter);
  }
}

function emitWhileStatement(node, emitter) {
  emitter.write('while (');
  emitExpression(node.test, emitter);
  emitter.write(') ');
  emitStatementBody(node.body, emitter);
}

function emitDoWhileStatement(node, emitter) {
  emitter.write('do ');
  emitStatementBody(node.body, emitter);
  emitter.write(' while (');
  emitExpression(node.test, emitter);
  emitter.write(');');
}

function emitStatementBody(node, emitter) {
  if (node.type === 'BlockStatement') {
    emitBlockStatement(node, emitter);
    return;
  }

  emitter.write('{');
  emitter.newline();
  emitter.indentLevel += 1;
  emitStatement(node, emitter);
  emitter.indentLevel -= 1;
  emitter.writeIndent();
  emitter.write('}');
}

function emitExpression(node, emitter, parent = { precedence: 0, operator: null, side: null }) {
  emitter.mark(node);

  switch (node.type) {
    case 'Identifier':
      emitter.write(node.name);
      break;
    case 'NumericLiteral':
      emitter.write(String(node.value));
      break;
    case 'BooleanLiteral':
      emitter.write(node.value ? 'true' : 'false');
      break;
    case 'StringLiteral':
      emitter.write(JSON.stringify(node.value));
      break;
    case 'UnaryExpression':
      emitUnaryExpression(node, emitter, parent);
      break;
    case 'BinaryExpression':
    case 'LogicalExpression':
      emitBinaryLikeExpression(node, emitter, parent);
      break;
    case 'AssignmentExpression':
      emitAssignmentExpression(node, emitter, parent);
      break;
    case 'MemberExpression':
      emitMemberExpression(node, emitter, parent);
      break;
    case 'CallExpression':
      emitCallExpression(node, emitter, parent);
      break;
    case 'ObjectExpression':
      emitObjectExpression(node, emitter);
      break;
    case 'ArrowFunctionExpression':
      emitArrowFunctionExpression(node, emitter);
      break;
    default:
      throw new Error(`Unsupported expression node: ${node.type}`);
  }

  emitter.setCode(node, emitter.toString());
}

function emitUnaryExpression(node, emitter, parent) {
  const precedence = 8;
  const needsParens = precedence < parent.precedence;

  if (needsParens) emitter.write('(');
  emitter.write(node.operator);
  emitExpression(node.argument, emitter, { precedence, operator: node.operator, side: 'argument' });
  if (needsParens) emitter.write(')');
}

function emitBinaryLikeExpression(node, emitter, parent) {
  const precedence = BINARY_PRECEDENCE[node.operator];
  const needsParens = shouldParenthesize(precedence, node.operator, parent);

  if (needsParens) emitter.write('(');
  emitExpression(node.left, emitter, { precedence, operator: node.operator, side: 'left' });
  emitter.write(` ${node.operator} `);
  emitExpression(node.right, emitter, { precedence, operator: node.operator, side: 'right' });
  if (needsParens) emitter.write(')');
}

function emitAssignmentExpression(node, emitter, parent) {
  const precedence = 1;
  const needsParens = precedence < parent.precedence;

  if (needsParens) emitter.write('(');
  emitExpression(node.left, emitter, { precedence, operator: node.operator, side: 'left' });
  emitter.write(` ${node.operator} `);
  emitExpression(node.right, emitter, { precedence, operator: node.operator, side: 'right' });
  if (needsParens) emitter.write(')');
}

function emitMemberExpression(node, emitter, parent) {
  const precedence = 9;
  const needsParens = precedence < parent.precedence;

  if (needsParens) emitter.write('(');
  emitExpression(node.object, emitter, { precedence, operator: null, side: 'object' });

  if (node.computed) {
    emitter.write('[');
    emitExpression(node.property, emitter);
    emitter.write(']');
  } else {
    emitter.write('.');
    emitExpression(node.property, emitter, { precedence, operator: null, side: 'property' });
  }

  if (needsParens) emitter.write(')');
}

function emitCallExpression(node, emitter, parent) {
  const precedence = 9;
  const needsParens = precedence < parent.precedence;

  if (needsParens) emitter.write('(');
  emitExpression(node.callee, emitter, { precedence, operator: null, side: 'callee' });
  emitter.write('(');

  node.arguments.forEach((argument, index) => {
    if (index > 0) emitter.write(', ');
    emitExpression(argument, emitter);
  });

  emitter.write(')');
  if (needsParens) emitter.write(')');
}

function emitObjectExpression(node, emitter) {
  emitter.write('{ ');
  node.properties.forEach((property, index) => {
    if (index > 0) emitter.write(', ');
    emitExpression(property.key, emitter);
    emitter.write(': ');
    emitExpression(property.value, emitter);
  });
  emitter.write(' }');
}

function emitArrowFunctionExpression(node, emitter) {
  emitter.write('() => ');
  emitExpression(node.body, emitter);
}

function shouldParenthesize(precedence, operator, parent) {
  if (precedence < parent.precedence) return true;
  if (precedence !== parent.precedence || parent.side !== 'right') return false;

  if (parent.operator === '&&' && operator === '&&') return false;
  if (parent.operator === '||' && operator === '||') return false;
  if (parent.operator === '+' && operator === '+') return false;
  if (parent.operator === '' && operator === '') return false;

  return true;
}

module.exports = generateJavaScript;
