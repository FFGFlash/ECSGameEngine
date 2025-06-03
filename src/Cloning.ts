import cloneDeep from 'clone-deep'

const Clone = Symbol('Clone')

export default Clone

export function handleInstanceCloning(val: any): any {
  if ('Clone' in val) return val[Clone]()
  const res = new val.constructor()
  for (let key in val) {
    res[key] = cloneDeep(val[key], handleInstanceCloning)
  }
  return res
}
