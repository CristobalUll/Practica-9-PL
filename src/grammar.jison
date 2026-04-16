
%{
  // helpers JS opcionales
%}

%start program

%token IF ELSE WHILE DO BREAK TRUE FALSE INT FLOAT CHAR BOOL PRINT
%token ID NUM REAL STRING
%token OR AND EQ NE LE GE
%token EOF

%left OR
%left AND
%left EQ NE
%left '<' '>' LE GE
%left '+' '-'
%left '*' '/'
%right '!'
%right UMINUS
%nonassoc LOWER_THAN_ELSE
%nonassoc ELSE

%%

program
  : block EOF
    { return buildProgram([$1], @$); }
  ;


block
  : '{' decls stmts '}'
    { $$ = buildBlock([...$2, ...$3], @$); }
  ;

decls
  : /* empty */
    { $$ = []; }
  | decls decl
    { $$ = [...$1, $2]; }
  ;

decl
  : type ID ';'
    { $$ = buildDecl($1, $2, @$); }
  ;

type
  : basic
    { $$ = buildType($1, @$); }
  | type '[' NUM ']'
    { $$ = buildArrayType($1, $3, @$); }
  ;

basic
  : INT
    { $$ = buildBasicType('int'); }
  | FLOAT
    { $$ = buildBasicType('float'); }
  | CHAR
    { $$ = buildBasicType('char'); }
  | BOOL
    { $$ = buildBasicType('bool'); }
  ;

stmts
  : /* empty */
    { $$ = []; }
  | stmts stmt
    { $$ = [...$1, $2]; }
  ;

stmt
  : loc '=' bool ';'
    { $$ = buildAssignmentStatement($1, $3, @$, @2); }
  | IF '(' bool ')' stmt %prec LOWER_THAN_ELSE
    { $$ = buildIfStatement($3, $5, null, @$); }
  | IF '(' bool ')' stmt ELSE stmt
    { $$ = buildIfStatement($3, $5, $7, @$); }
  | WHILE '(' bool ')' stmt
    { $$ = buildWhileStatement($3, $5, @$); }
  | DO stmt WHILE '(' bool ')' ';'
    { $$ = buildDoWhileStatement($2, $5, @$); }
  | BREAK ';'
    { $$ = buildBreakStatement(@$); }
  | PRINT '(' bool ')' ';'
    { $$ = buildPrintStmt($3, @$); }
  | block
    { $$ = $1; }
  | ';'
    { $$ = { type: 'EmptyStatement' }; }
  ;

loc
  : ID
    { $$ = buildIdentifier($1, @$); }
  | loc '[' bool ']'
    { $$ = buildMemberExpression($1, $3, @$); }
  ;

bool
  : bool OR join
    { $$ = buildBinary('||', $1, $3, @$); }
  | join
    { $$ = $1; }
  ;

join
  : join AND equality
    { $$ = buildBinary('&&', $1, $3, @$); }
  | equality
    { $$ = $1; }
  ;

equality
  : equality EQ rel
    { $$ = buildBinary('==', $1, $3, @$); }
  | equality NE rel
    { $$ = buildBinary('!=', $1, $3, @$); }
  | rel
    { $$ = $1; }
  ;

rel
  : expr '<' expr
    { $$ = buildBinary('<', $1, $3, @$); }
  | expr '>' expr
    { $$ = buildBinary('>', $1, $3, @$); }
  | expr LE expr
    { $$ = buildBinary('<=', $1, $3, @$); }
  | expr GE expr
    { $$ = buildBinary('>=', $1, $3, @$); }
  | expr
    { $$ = $1; }
  ;

expr
  : expr '+' term
    { $$ = buildBinary('+', $1, $3, @$); }
  | expr '-' term
    { $$ = buildBinary('-', $1, $3, @$); }
  | term
    { $$ = $1; }
  ;

term
  : term '*' unary
    { $$ = buildBinary('*', $1, $3, @$); }
  | term '/' unary
    { $$ = buildBinary('/', $1, $3, @$); }
  | unary
    { $$ = $1; }
  ;

unary
  : '!' unary
    { $$ = buildUnary('!', $2, @$); }
  | '-' unary %prec UMINUS
    { $$ = buildUnary('-', $2, @$); }
  | factor
    { $$ = $1; }
  ;

factor
  : '(' bool ')'
    { $$ = $2; }
  | loc
    { $$ = $1; }
  | NUM
    { $$ = buildNumericLiteral($1, @$); }
  | REAL
    { $$ = buildNumericLiteral($1, @$); }
  | TRUE
    { $$ = buildBooleanLiteral(true, @$); }
  | FALSE
    { $$ = buildBooleanLiteral(false, @$); }
  | STRING
    { $$ = buildStringLiteral($1, @$); }
  ;

%%

// Builder function for variable declarations
function buildDecl(typeNode, name, loc) {
  const { basicType, dimensions } = extractTypeInfo(typeNode);
  const id = buildIdentifier(name, loc);
  const init = generateArrayInit(dimensions, basicType);

  return withLoc({
    type: 'VariableDeclaration',
    kind: 'let',
    declarations: [
      {
        type: 'VariableDeclarator',
        id,
        init
      }
    ]
  }, loc);
}

// Builder function for basic types
function buildBasicType(basicTypeName) {
  return {
    kind: 'basic',
    name: basicTypeName
  }
}

// Builder function for print statements (converts to console.log)
function buildPrintStmt(expression, loc) {
  return withLoc({
    type: 'ExpressionStatement',
    expression: {
      type: 'CallExpression',
      callee: {
        type: 'MemberExpression',
        object: buildSystemIdentifier('console', loc),
        property: buildSystemIdentifier('log', loc),
        computed: false
      },
      arguments: [expression]
    }
  }, loc);
}

function toLoc(jisonLoc) {
  if (!jisonLoc) return undefined;
  return {
    start: { line: jisonLoc.first_line, column: jisonLoc.first_column },
    end: { line: jisonLoc.last_line, column: jisonLoc.last_column }
  };
}

function withLoc(node, jisonLoc) {
  if (!node || !jisonLoc) return node;
  node.loc = toLoc(jisonLoc);
  return node;
}

function buildProgram(body, loc) {
  return withLoc({
    type: 'Program',
    sourceType: 'script',
    body
  }, loc);
}

function buildBlock(body, loc) {
  return withLoc({
    type: 'BlockStatement',
    body
  }, loc);
}

function buildType(typeNode, loc) {
  return withLoc(typeNode, loc);
}

function buildArrayType(elementType, size, loc) {
  return withLoc({
    kind: 'array',
    elementType,
    size
  }, loc);
}

function buildIdentifier(name, loc) {
  return withLoc({
    type: 'Identifier',
    name: `$${name}`,
  }, loc);
}

// Helper function for system-generated identifiers (not prefixed)
function buildSystemIdentifier(name, loc) {
  return withLoc({
    type: 'Identifier',
    name
  }, loc);
}

function buildMemberExpression(object, property, loc) {
  return withLoc({
    type: 'MemberExpression',
    object,
    property,
    computed: true
  }, loc);
}

function buildBinary(operator, left, right, loc) {
  const logicalOps = new Set(['&&', '||']);
  return withLoc({
    type: logicalOps.has(operator) ? 'LogicalExpression' : 'BinaryExpression',
    operator,
    left,
    right
  }, loc);
}

function buildUnary(operator, argument, loc) {
  return withLoc({
    type: 'UnaryExpression',
    operator,
    argument,
    prefix: true
  }, loc);
}

function buildNumericLiteral(value, loc) {
  return withLoc({
    type: 'NumericLiteral',
    value
  }, loc);
}

function buildBooleanLiteral(value, loc) {
  return withLoc({
    type: 'BooleanLiteral',
    value
  }, loc);
}

function buildStringLiteral(rawString, loc) {
  return withLoc({
    type: 'StringLiteral',
    value: rawString
  }, loc);
}

function buildAssignmentStatement(left, right, stmtLoc, exprLoc) {
  const expr = withLoc({
    type: 'AssignmentExpression',
    operator: '=',
    left,
    right
  }, exprLoc);

  return withLoc({
    type: 'ExpressionStatement',
    expression: expr
  }, stmtLoc);
}

function buildIfStatement(test, consequent, alternate, loc) {
  return withLoc({
    type: 'IfStatement',
    test,
    consequent,
    alternate: alternate || null
  }, loc);
}

function buildWhileStatement(test, body, loc) {
  return withLoc({
    type: 'WhileStatement',
    test,
    body
  }, loc);
}

function buildDoWhileStatement(body, test, loc) {
  return withLoc({
    type: 'DoWhileStatement',
    body,
    test
  }, loc);
}

function buildBreakStatement(loc) {
  return withLoc({
    type: 'BreakStatement'
  }, loc);
}

// Helper function to extract basic type and array dimensions from a type node
function extractTypeInfo(typeNode) {
  const dimensions = [];
  let currentType = typeNode;
  
  // Traverse the type hierarchy to collect dimensions
  while (currentType && currentType.kind === 'array') {
    dimensions.push(currentType.size);
    currentType = currentType.elementType;
  }
  
  return { basicType: currentType, dimensions };
}

// Helper function to generate default value expression based on type
function getDefaultValue(basicTypeNode) {
  switch (basicTypeNode?.name) {
    case 'int':
    case 'float':
      return buildNumericLiteral(0);
    case 'bool':
      return buildBooleanLiteral(false);
    case 'char':
      return buildStringLiteral('');
    default:
      throw new Error(`Unknown basic type: ${basicTypeNode?.name}`);
  }
}

// Helper function to generate array initialization (ES5-compatible)
function generateArrayInit(dimensions, basicTypeNode) {
  const defaultValue = getDefaultValue(basicTypeNode);
  
  if (dimensions.length === 0) {
    return defaultValue; // Return default value for scalar variables
  }

  const [currentDim, ...restDims] = dimensions;
  const innerInit = generateArrayInit(restDims, basicTypeNode);

  return {
    type: 'CallExpression',
    callee: {
      type: 'MemberExpression',
      object: buildSystemIdentifier('Array'),
      property: buildSystemIdentifier('from'),
      computed: false
    },
    arguments: [
      {
        type: 'ObjectExpression',
        properties: [
          {
            type: 'ObjectProperty',
            key: buildSystemIdentifier('length'),
            value: buildNumericLiteral(currentDim),
            computed: false,
            shorthand: false
          }
        ]
      },
      {
        type: 'ArrowFunctionExpression',
        params: [],
        body: innerInit,
        expression: true
      }
    ]
  }; 
}