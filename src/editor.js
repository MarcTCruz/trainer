import { EditorView, keymap } from '@codemirror/view'
import {
  lineNumbers,
  highlightActiveLineGutter,
  highlightActiveLine,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightSpecialChars,
} from '@codemirror/view'
import { EditorState } from '@codemirror/state'
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

export function onFormat(cb) {
  formatCallback = cb
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
