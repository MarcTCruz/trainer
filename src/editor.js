import { EditorView, basicSetup } from 'codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { EditorState } from '@codemirror/state'

const darkTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#1a1a2e',
      color: '#e0e0e0',
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
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: '#2a2a4a',
    },
    '.cm-gutters': {
      backgroundColor: '#151528',
      color: '#8888a8',
      border: 'none',
    },
    '.cm-activeLine': {
      backgroundColor: '#1e1e3a',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#1e1e3a',
      color: '#64ffda',
    },
  },
  { dark: true },
)

export function createEditor(parentElement, initialCode) {
  const state = EditorState.create({
    doc: initialCode,
    extensions: [basicSetup, javascript(), darkTheme],
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
