/* lexer written in Jison for the Dragon Book language */
/* translation of the by hand lexer in files lexer.js and tokens.js */

%{
// Keywords mapping
const keywords = new Map([
    ['if', 'IF'],
    ['else', 'ELSE'], 
    ['while', 'WHILE'],
    ['do', 'DO'],
    ['break', 'BREAK'],
    ['true', 'TRUE'],
    ['false', 'FALSE'],
    ['int', 'INT'],
    ['float', 'FLOAT'],
    ['char', 'CHAR'],
    ['bool', 'BOOL'],
    ['print', 'PRINT']
]);
%}



%%

[ \t\r]+                    { /* ignore whitespace */ }
\n+                         { /* ignore newlines */ }

"//".*                      { /* ignore single-line comments */ }
"/*"[^*]*\*+([^/*][^*]*\*+)*"/"   { /* ignore multi-line comments */ }

"||"                        { return 'OR'; }
"&&"                        { return 'AND'; }
"=="                        { return 'EQ'; }
"!="                        { return 'NE'; }
"<="                        { return 'LE'; }
">="                        { return 'GE'; }

"="                         { return '='; }
"<"                         { return '<'; }
">"                         { return '>'; }
"+"                         { return '+'; }
"-"                         { return '-'; }
"*"                         { return '*'; }
"/"                         { return '/'; }
"!"                         { return '!'; }

";"                         { return ';'; }
"("                         { return '('; }
")"                         { return ')'; }
"{"                         { return '{'; }
"}"                         { return '}'; }
"["                         { return '['; }
"]"                         { return ']'; }

[0-9]+\.[0-9]+              { yytext = Number(yytext); return 'REAL'; }
[0-9]+                      { yytext = Number(yytext); return 'NUM'; }

\'([^\\\n]|(\\.))*?\'       { yytext = yytext.slice(1, -1); return 'STRING'; }
\"([^\\\n]|(\\.))*?\"       { yytext = yytext.slice(1, -1); return 'STRING'; }

[a-zA-Z_][a-zA-Z0-9_]*      {
                              const kw = keywords.get(yytext);
                              if (kw) return kw;
                              return 'ID';
                            }

/* End of file */
<<EOF>>                     { return 'EOF'; }

/* Catch-all for any other character */
.                           { 
                              const loc = (yylloc?.first_line) ? ` at line ${yylloc.first_line}, column ${yylloc.first_column}` : '';
                              throw new Error('Illegal character: ' + yytext + loc); 
                            }
