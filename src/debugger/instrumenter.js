import { parse } from 'acorn';
import { generate } from 'astring';

// ─── Scope analysis ───────────────────────────────────────────────────────────

function makeScope(parent, kind) {
  return { parent, kind, vars: new Map() };
}

// Returns the enclosing function scope (or root if none).
function functionScope(scope) {
  let s = scope;
  while (s.parent && s.kind !== 'function') s = s.parent;
  return s;
}

// Extracts all bound names from any binding pattern.
function boundNames(pattern) {
  if (!pattern) return [];
  if (pattern.type === 'Identifier') return [pattern.name];
  if (pattern.type === 'RestElement') return boundNames(pattern.argument);
  if (pattern.type === 'AssignmentPattern') return boundNames(pattern.left);
  if (pattern.type === 'ObjectPattern')
    return pattern.properties.flatMap(p =>
      p.type === 'RestElement' ? boundNames(p.argument) : boundNames(p.value)
    );
  if (pattern.type === 'ArrayPattern')
    return pattern.elements.flatMap(e => (e ? boundNames(e) : []));
  return [];
}

// Records a declaration into the right scope, respecting var-hoisting.
function declare(scope, name, pos, declKind) {
  const target = declKind === 'var' ? functionScope(scope) : scope;
  if (!target.vars.has(name)) target.vars.set(name, pos);
}

// Collects all declarations reachable from the given scope chain (TDZ-aware).
function visibleVars(scope, stmtPos) {
  const seen = new Set();
  const result = [];
  let s = scope;
  while (s) {
    for (const [name, declPos] of s.vars) {
      if (!seen.has(name) && declPos < stmtPos) {
        seen.add(name);
        result.push(name);
      }
    }
    s = s.parent;
  }
  return result;
}

// Walk the AST once to register all declarations into scopes.
// Returns a Map<ASTNode, Scope> so instrumentation can look up scope by node.
function buildScopeMap(ast) {
  const nodeScope = new Map();
  const root = makeScope(null, 'function'); // global acts as function scope for var

  function walk(node, scope) {
    if (!node || typeof node !== 'object' || !node.type) return;
    nodeScope.set(node, scope);

    switch (node.type) {
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression': {
        // Register the function name in the OUTER scope.
        if (node.id) declare(scope, node.id.name, node.start, 'var');

        const fnScope = makeScope(scope, 'function');
        nodeScope.set(node, fnScope);
        for (const p of node.params) {
          for (const name of boundNames(p)) {
            declare(fnScope, name, node.start, 'let');
          }
        }
        walk(node.body, fnScope);
        return;
      }

      case 'BlockStatement': {
        const blockScope = makeScope(scope, 'block');
        nodeScope.set(node, blockScope);
        for (const s of node.body) walk(s, blockScope);
        return;
      }

      case 'VariableDeclaration': {
        for (const d of node.declarations) {
          for (const name of boundNames(d.id)) {
            declare(scope, name, node.start, node.kind);
          }
          if (d.init) walk(d.init, scope);
        }
        return;
      }

      case 'ForStatement': {
        // for (let/const i …) opens a new block scope around the whole loop.
        if (node.init && node.init.type === 'VariableDeclaration' &&
            (node.init.kind === 'let' || node.init.kind === 'const')) {
          const loopScope = makeScope(scope, 'block');
          nodeScope.set(node, loopScope);
          walk(node.init, loopScope);
          if (node.test) walk(node.test, loopScope);
          if (node.update) walk(node.update, loopScope);
          walk(node.body, loopScope);
          return;
        }
        break;
      }

      case 'ForInStatement':
      case 'ForOfStatement': {
        if (node.left && node.left.type === 'VariableDeclaration' &&
            (node.left.kind === 'let' || node.left.kind === 'const')) {
          const loopScope = makeScope(scope, 'block');
          nodeScope.set(node, loopScope);
          walk(node.left, loopScope);
          walk(node.right, scope);
          walk(node.body, loopScope);
          return;
        }
        break;
      }
    }

    // Generic child walk.
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const c of child) {
          if (c && typeof c === 'object' && c.type) walk(c, scope);
        }
      } else if (child && typeof child === 'object' && child.type) {
        walk(child, scope);
      }
    }
  }

  walk(ast, root);
  return { nodeScope, root };
}

// ─── AST builder helpers ──────────────────────────────────────────────────────

function callExpr(callee, args) {
  return {
    type: 'ExpressionStatement',
    expression: {
      type: 'CallExpression',
      callee: { type: 'Identifier', name: callee },
      arguments: args,
    },
  };
}

function literal(value) {
  return { type: 'Literal', value, raw: JSON.stringify(value) };
}

function snappedValue(name) {
  return {
    type: 'CallExpression',
    callee: { type: 'Identifier', name: '__snap' },
    arguments: [{ type: 'Identifier', name }],
  };
}

function objectExpr(names) {
  return {
    type: 'ObjectExpression',
    properties: names.map(n => ({
      type: 'Property',
      key: { type: 'Identifier', name: n },
      value: snappedValue(n),
      kind: 'init',
      shorthand: false,
      computed: false,
      method: false,
    })),
  };
}

function stepCall(line, vars) {
  return callExpr('__step', [literal(line), objectExpr(vars)]);
}

function callEnterCall(name, params) {
  return callExpr('__callEnter', [literal(name), objectExpr(params)]);
}

function callExitCall() {
  return callExpr('__callExit', []);
}

// ─── Instrumentation ─────────────────────────────────────────────────────────

// Resolves the function name for anonymous functions assigned to variables.
function resolveFunctionName(node, parent) {
  if (node.id) return node.id.name;
  if (
    parent &&
    parent.type === 'VariableDeclarator' &&
    parent.id &&
    parent.id.type === 'Identifier'
  ) {
    return parent.id.name;
  }
  return '<anonymous>';
}

function paramNames(params) {
  return params.flatMap(p => boundNames(p));
}

// Instruments a function body in-place.
function instrumentBody(bodyNode, fnName, params, nodeScope) {
  const scope = nodeScope.get(bodyNode);
  if (!scope) return;

  const enterCall = callEnterCall(fnName, params);
  const instrumented = [enterCall];

  for (const stmt of bodyNode.body) {
    const line = stmt.loc.start.line;
    const vars = visibleVars(scope, stmt.start);

    if (stmt.type === 'ReturnStatement') {
      instrumented.push(stepCall(line, vars));
      instrumented.push(callExitCall());
      instrumented.push(stmt);
      continue;
    }

    instrumented.push(stepCall(line, vars));
    instrumentStatement(stmt, nodeScope);
    instrumented.push(stmt);
  }

  // Implicit return — add __callExit at end unless last stmt is a return.
  const last = bodyNode.body[bodyNode.body.length - 1];
  if (!last || last.type !== 'ReturnStatement') {
    instrumented.push(callExitCall());
  }

  bodyNode.body = instrumented;
}

// Recursively instrument nested control-flow within a statement.
function instrumentStatement(node, nodeScope) {
  if (!node || typeof node !== 'object' || !node.type) return;

  switch (node.type) {
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      // Handled by the top-level walkForFunctions pass.
      return;

    case 'IfStatement': {
      node.consequent = wrapBranch(node.consequent, nodeScope);
      if (node.alternate) node.alternate = wrapBranch(node.alternate, nodeScope);
      return;
    }

    case 'WhileStatement':
    case 'DoWhileStatement': {
      node.body = wrapBranch(node.body, nodeScope);
      return;
    }

    case 'ForStatement':
    case 'ForInStatement':
    case 'ForOfStatement': {
      node.body = wrapBranch(node.body, nodeScope);
      return;
    }

    case 'TryStatement': {
      if (node.block) instrumentBlockStatements(node.block, nodeScope);
      if (node.handler && node.handler.body) instrumentBlockStatements(node.handler.body, nodeScope);
      if (node.finalizer) instrumentBlockStatements(node.finalizer, nodeScope);
      return;
    }

    case 'SwitchStatement': {
      const switchScope = nodeScope.get(node);
      if (switchScope) {
        for (const cas of node.cases) {
          cas.consequent = injectStepsIntoList(cas.consequent, switchScope);
        }
      }
      return;
    }
  }
}

// Wrap a single statement (possibly non-block) into a block with __step prepended.
function wrapBranch(node, nodeScope) {
  if (!node) return node;
  if (node.type === 'BlockStatement') {
    instrumentBlockStatements(node, nodeScope);
    return node;
  }
  const scope = nodeScope.get(node);
  const line = node.loc.start.line;
  const vars = scope ? visibleVars(scope, node.start) : [];
  if (node.type === 'ReturnStatement') {
    return {
      type: 'BlockStatement',
      body: [stepCall(line, vars), callExitCall(), node],
    };
  }
  instrumentStatement(node, nodeScope);
  return {
    type: 'BlockStatement',
    body: [stepCall(line, vars), node],
  };
}

function instrumentBlockStatements(blockNode, nodeScope) {
  const scope = nodeScope.get(blockNode);
  if (!scope) return;

  const result = [];
  for (const stmt of blockNode.body) {
    const line = stmt.loc.start.line;
    const vars = visibleVars(scope, stmt.start);

    if (stmt.type === 'ReturnStatement') {
      result.push(stepCall(line, vars));
      result.push(callExitCall());
      result.push(stmt);
      continue;
    }

    result.push(stepCall(line, vars));
    instrumentStatement(stmt, nodeScope);
    result.push(stmt);
  }
  blockNode.body = result;
}

function injectStepsIntoList(stmts, scope) {
  const result = [];
  for (const stmt of stmts) {
    const line = stmt.loc.start.line;
    const vars = visibleVars(scope, stmt.start);
    result.push(stepCall(line, vars));
    result.push(stmt);
  }
  return result;
}

// Walk the entire AST and instrument every function body bottom-up.
function walkForFunctions(node, parentNode, nodeScope) {
  if (!node || typeof node !== 'object' || !node.type) return;

  const isFn =
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression';

  if (isFn) {
    // Walk children FIRST so nested functions are instrumented bottom-up.
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const c of child) walkForFunctions(c, node, nodeScope);
      } else if (child && typeof child === 'object' && child.type) {
        walkForFunctions(child, node, nodeScope);
      }
    }

    if (node.body && node.body.type === 'BlockStatement') {
      const name = resolveFunctionName(node, parentNode);
      const pNames = paramNames(node.params);
      instrumentBody(node.body, name, pNames, nodeScope);
    }
    return;
  }

  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const c of child) walkForFunctions(c, node, nodeScope);
    } else if (child && typeof child === 'object' && child.type) {
      walkForFunctions(child, node, nodeScope);
    }
  }
}

function injectTopLevelSteps(program, nodeScope) {
  const result = [];
  for (const stmt of program.body) {
    // Function declarations: already instrumented by walkForFunctions — just emit.
    if (stmt.type === 'FunctionDeclaration') {
      result.push(stmt);
      continue;
    }
    const scope = nodeScope.get(stmt) || nodeScope.get(program);
    const line = stmt.loc.start.line;
    const vars = scope ? visibleVars(scope, stmt.start) : [];
    result.push(stepCall(line, vars));
    result.push(stmt);
  }
  program.body = result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function instrumentCode(sourceCode) {
  try {
    const ast = parse(sourceCode, {
      ecmaVersion: 2022,
      sourceType: 'script',
      locations: true,
    });

    const { nodeScope } = buildScopeMap(ast);
    walkForFunctions(ast, null, nodeScope);
    injectTopLevelSteps(ast, nodeScope);

    const SNAP_HELPER = `function __snap(v){if(v instanceof Map)return{__type:"Map",size:v.size,entries:Array.from(v)};if(v instanceof Set)return{__type:"Set",size:v.size,values:Array.from(v)};return v}`;
    const code = SNAP_HELPER + '\n' + generate(ast);
    return { code, error: null };
  } catch (err) {
    return { code: null, error: err.message };
  }
}
