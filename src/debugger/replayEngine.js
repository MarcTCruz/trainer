export function createReplayEngine(trace, callEvents = []) {
  let index = 0
  let breakpoints = new Set()
  const subscribers = new Set()

  const sortedCallEvents = [...callEvents].sort((a, b) => a.traceIndex - b.traceIndex)

  function buildCallStackAt(targetIndex) {
    const stack = []
    for (const event of sortedCallEvents) {
      if (event.traceIndex > targetIndex) break
      if (event.type === 'enter') {
        stack.push(event.name)
      } else if (event.type === 'exit') {
        stack.pop()
      }
    }
    return stack
  }

  function currentEntry() {
    if (trace.length === 0) return null
    return trace[index]
  }

  function makeState() {
    return {
      index,
      entry: currentEntry(),
      atStart: index === 0,
      atEnd: trace.length === 0 || index === trace.length - 1,
      traceLength: trace.length,
      callStack: buildCallStackAt(index),
    }
  }

  function notify() {
    const state = makeState()
    for (const cb of subscribers) {
      cb(state)
    }
    return state
  }

  function setIndex(next) {
    index = next
    return notify()
  }

  function stepInto() {
    if (trace.length === 0) return makeState()
    return setIndex(Math.min(index + 1, trace.length - 1))
  }

  function stepOver() {
    if (trace.length === 0) return makeState()
    const currentDepth = trace[index].depth
    for (let i = index + 1; i < trace.length; i++) {
      if (trace[i].depth <= currentDepth) return setIndex(i)
    }
    return setIndex(trace.length - 1)
  }

  function stepOut() {
    if (trace.length === 0) return makeState()
    const currentDepth = trace[index].depth
    for (let i = index + 1; i < trace.length; i++) {
      if (trace[i].depth < currentDepth) return setIndex(i)
    }
    return setIndex(trace.length - 1)
  }

  function stepBack() {
    if (trace.length === 0) return makeState()
    return setIndex(Math.max(index - 1, 0))
  }

  function continueForward() {
    if (trace.length === 0) return makeState()
    for (let i = index + 1; i < trace.length; i++) {
      if (breakpoints.has(trace[i].line)) return setIndex(i)
    }
    return setIndex(trace.length - 1)
  }

  function continueBackward() {
    if (trace.length === 0) return makeState()
    for (let i = index - 1; i >= 0; i--) {
      if (breakpoints.has(trace[i].line)) return setIndex(i)
    }
    return setIndex(0)
  }

  function runToCursor(line) {
    if (trace.length === 0) return makeState()
    for (let i = index + 1; i < trace.length; i++) {
      if (trace[i].line === line) return setIndex(i)
    }
    return makeState()
  }

  function reset() {
    if (trace.length === 0) return makeState()
    return setIndex(0)
  }

  function jumpTo(idx) {
    if (trace.length === 0) return makeState()
    return setIndex(Math.max(0, Math.min(idx, trace.length - 1)))
  }

  function toggleBreakpoint(line) {
    if (breakpoints.has(line)) {
      breakpoints.delete(line)
    } else {
      breakpoints.add(line)
    }
  }

  function setBreakpoints(lineSet) {
    breakpoints = new Set(lineSet)
  }

  function getBreakpoints() {
    return breakpoints
  }

  function getState() {
    return makeState()
  }

  function getTrace() {
    return trace
  }

  function subscribe(callback) {
    subscribers.add(callback)
    return () => subscribers.delete(callback)
  }

  return {
    stepInto,
    stepOver,
    stepOut,
    stepBack,
    continueForward,
    continueBackward,
    runToCursor,
    reset,
    jumpTo,
    toggleBreakpoint,
    setBreakpoints,
    getBreakpoints,
    getState,
    getTrace,
    subscribe,
  }
}
