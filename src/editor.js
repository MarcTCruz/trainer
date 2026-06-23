import { EditorView, keymap } from '@codemirror/view'
import {
  lineNumbers,
  highlightActiveLineGutter,
  highlightActiveLine,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightSpecialChars,
  Decoration,
  gutter,
  GutterMarker,
} from '@codemirror/view'
import { EditorState, StateField, StateEffect, RangeSet } from '@codemirror/state'
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands'
import {
  foldGutter,
  indentOnInput,
  bracketMatching,
  syntaxHighlighting,
  defaultHighlightStyle,
  foldKeymap,
} from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark, oneDarkHighlightStyle } from '@codemirror/theme-one-dark'

const editorOverrides = EditorView.theme(
  {
    '&': {
      fontSize: '14px',
      borderRadius: '8px',
      border: '1px solid #3d3d60',
    },
    '.cm-content': {
      caretColor: '#64ffda',
      fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
    },
    '.cm-cursor': {
      borderLeftColor: '#64ffda',
    },
    '.cm-gutters': {
      color: '#8888a8',
    },
    '.cm-activeLineGutter': {
      color: '#64ffda',
    },
  },
  { dark: true },
)

let formatCallback = null
let breakpointCallback = null
let changeCallback = null

export function onFormat(cb) {
  formatCallback = cb
}

export function onBreakpointToggle(cb) {
  breakpointCallback = cb
}

export function onChange(cb) {
  changeCallback = cb
}

class BreakpointMarker extends GutterMarker {
  toDOM() {
    const el = document.createElement('div')
    el.className = 'cm-debugger-breakpoint'
    el.textContent = '●'
    return el
  }
}

const breakpointMarker = new BreakpointMarker()

const breakpointState = StateField.define({
  create() {
    return new Set()
  },
  update(value, tr) {
    const next = new Set(value)
    for (const effect of tr.effects) {
      if (effect.is(toggleBreakpointEffect)) {
        const line = effect.value
        if (next.has(line)) {
          next.delete(line)
        } else {
          next.add(line)
        }
      }
    }
    return next
  },
})

const toggleBreakpointEffect = StateEffect.define()

const setDebugLineEffect = StateEffect.define()

const debugLineState = StateField.define({
  create() {
    return Decoration.none
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setDebugLineEffect)) {
        const lineNum = effect.value
        if (lineNum < 0) return Decoration.none
        const line = tr.state.doc.line(lineNum)
        return Decoration.set([
          Decoration.line({ class: 'cm-debugger-active-line' }).range(line.from),
        ])
      }
    }
    return value.map(tr.changes)
  },
  provide(field) {
    return EditorView.decorations.from(field)
  },
})

const breakpointGutter = gutter({
  class: 'cm-breakpoint-gutter',
  markers(view) {
    const bps = view.state.field(breakpointState)
    const markers = []
    for (const lineNum of bps) {
      if (lineNum > view.state.doc.lines) continue
      const line = view.state.doc.line(lineNum)
      markers.push(breakpointMarker.range(line.from))
    }
    return markers.length ? RangeSet.of(markers, true) : RangeSet.empty
  },
  domEventHandlers: {
    mousedown(view, line) {
      const lineNum = view.state.doc.lineAt(line.from).number
      view.dispatch({ effects: toggleBreakpointEffect.of(lineNum) })
      const bps = view.state.field(breakpointState)
      if (breakpointCallback) breakpointCallback(lineNum, bps)
      return true
    },
  },
})

export function setDebugLine(editor, lineNumber) {
  editor.dispatch({ effects: setDebugLineEffect.of(lineNumber) })
}

export function toggleBreakpoint(editor, lineNumber) {
  editor.dispatch({ effects: toggleBreakpointEffect.of(lineNumber) })
  return editor.state.field(breakpointState)
}

export function clearDebugDecorations(editor) {
  editor.dispatch({ effects: setDebugLineEffect.of(-1) })
}

const formatKeymap = keymap.of([
  {
    key: 'Shift-Alt-f',
    run: () => {
      if (formatCallback) formatCallback()
      return true
    },
  },
])

export function createEditor(parentElement, initialCode) {
  const state = EditorState.create({
    doc: initialCode,
    extensions: [
      lineNumbers(),
      breakpointGutter,
      breakpointState,
      debugLineState,
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      bracketMatching(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap, ...searchKeymap]),
      javascript(),
      oneDark,
      syntaxHighlighting(oneDarkHighlightStyle),
      formatKeymap,
      editorOverrides,
      EditorView.updateListener.of((update) => {
        if (update.docChanged && changeCallback) changeCallback(update.state.doc.toString())
      }),
    ],
  })

  return new EditorView({
    state,
    parent: parentElement,
  })
}

export function getCode(editor) {
  return editor.state.doc.toString()
}

export function setCode(editor, code) {
  editor.dispatch({
    changes: {
      from: 0,
      to: editor.state.doc.length,
      insert: code,
    },
  })
}
