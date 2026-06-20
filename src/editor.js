import { EditorView, basicSetup } from 'codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { EditorState } from '@codemirror/state'
import { oneDark, oneDarkHighlightStyle } from '@codemirror/theme-one-dark'
import { syntaxHighlighting } from '@codemirror/language'

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

export function createEditor(parentElement, initialCode) {
  const state = EditorState.create({
    doc: initialCode,
    extensions: [
      basicSetup,
      javascript(),
      oneDark,
      syntaxHighlighting(oneDarkHighlightStyle),
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
