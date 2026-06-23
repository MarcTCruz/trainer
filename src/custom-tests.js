import { get, set } from './storage.js'

const STORAGE_KEY = 'trainer_custom_tests'

function loadAll() {
  return get(STORAGE_KEY) ?? {}
}

function saveAll(data) {
  set(STORAGE_KEY, data)
}

export function getCustomTests(exerciseId) {
  return loadAll()[exerciseId] ?? []
}

export function addCustomTest(exerciseId, input, expected) {
  const all = loadAll()
  const tests = all[exerciseId] ?? []
  tests.push({ input, expected })
  all[exerciseId] = tests
  saveAll(all)
  return tests
}

export function removeCustomTest(exerciseId, index) {
  const all = loadAll()
  const tests = all[exerciseId] ?? []
  tests.splice(index, 1)
  all[exerciseId] = tests
  saveAll(all)
  return tests
}
