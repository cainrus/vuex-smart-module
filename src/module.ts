import {
  Store,
  StoreOptions,
  Plugin as VuexPlugin,
  GetterTree,
  CommitOptions,
  DispatchOptions,
  MutationTree
} from 'vuex'
import { BG0, BM0, BA0, Payload } from './assets'
import { get, assert, Class, mapValues } from './utils'

export interface Commit<M> {
  <K extends keyof M>(
    type: K,
    payload: Payload<M[K]>,
    options?: CommitOptions
  ): void
  <K extends keyof M>(
    payload: Payload<M[K]> & { type: K },
    options?: CommitOptions
  ): void
}

export interface Dispatch<A> {
  <K extends keyof A>(
    type: K,
    payload: Payload<A[K]>,
    options?: DispatchOptions
  ): Promise<any>
  <K extends keyof A>(
    payload: Payload<A[K]> & { type: K },
    options?: DispatchOptions
  ): Promise<any>
}

export interface ModuleOptions<S, G extends BG0, M extends BM0, A extends BA0> {
  state?: Class<S>
  getters?: Class<G>
  mutations?: Class<M>
  actions?: Class<A>
  modules?: Record<string, Module<any, any, any, any>>
}

export class Module<S, G extends BG0, M extends BM0, A extends BA0> {
  private path: string[] | undefined = undefined
  private store: Store<any> | undefined = undefined

  commit: Commit<M> = (type: any, payload: any, options?: any): void => {
    assert(
      this.path && this.store,
      'you need to provide the module into the Vuex store before using it.'
    )
    return this.normalizedDispatch(this.store!.commit, type, payload, options)
  }

  dispatch: Dispatch<A> = (type: any, payload: any, options?: any): any => {
    assert(
      this.path && this.store,
      'you need to provide the module into the Vuex store before using it.'
    )
    return this.normalizedDispatch(this.store!.dispatch, type, payload, options)
  }

  constructor(private options: ModuleOptions<S, G, M, A> = {}) {}

  create(): StoreOptions<any> {
    const { state, getters, mutations, actions, modules } = this.options

    return {
      state: state ? new state() : {},
      getters: getters ? initGetters(getters, this) : {},
      mutations: mutations ? initMutations(mutations, this) : {},
      actions: actions ? initActions(actions, this) : {},
      modules: !modules
        ? undefined
        : mapValues(modules, m => {
            return {
              namespaced: true,
              ...m.create()
            }
          })
    }
  }

  plugin(): VuexPlugin<any> {
    return store => {
      this.setStore(store, [])
    }
  }

  get state(): S {
    assert(
      this.path && this.store,
      'you need to provide the module into the Vuex store before using it.'
    )
    return get(this.path!, this.store!.state)
  }

  get getters(): G {
    assert(
      this.path && this.store,
      'you need to provide the module into the Vuex store before using it.'
    )
    return this.namespacedGetters()
  }

  private setStore(store: Store<any>, path: string[]): void {
    this.path = path
    this.store = store

    const modules = this.options.modules
    if (modules) {
      Object.keys(modules).forEach(key => {
        const m = modules[key]
        const p = path.concat(key)
        m.setStore(store, p)
      })
    }
  }

  private normalizedDispatch(
    dispatch: Function,
    type: any,
    payload: any,
    options: any
  ): any {
    if (typeof type === 'string') {
      return dispatch(this.namespacedType(type), payload, options)
    } else {
      return dispatch(
        {
          ...type,
          type: this.namespacedType(type.type)
        },
        payload
      )
    }
  }

  private namespacedGetters(): G {
    const namespace = this.namespace()
    const sliceIndex = namespace.length
    const getters: Record<string, any> = {}

    Object.keys(this.store!.getters).forEach(key => {
      const sameNamespace = namespace !== key.slice(0, sliceIndex)
      const name = key.slice(sliceIndex)
      if (sameNamespace && name) {
        return
      }

      Object.defineProperty(getters, name, {
        get: () => this.store!.getters[key],
        enumerable: true
      })
    })

    return getters as G
  }

  private namespace(): string {
    const path = this.path!
    return path.length === 0 ? '' : path.join('/') + '/'
  }

  private namespacedType(type: string): string {
    return this.namespace() + type
  }
}

function initGetters<S, G extends BG0, M extends BM0, A extends BA0>(
  Getters: Class<G>,
  module: Module<S, G, M, A>
): GetterTree<any, any> {
  const getters: any = new Getters()
  getters.__module__ = module
  const options: GetterTree<any, any> = {}

  Object.getOwnPropertyNames(Getters.prototype).forEach(key => {
    if (key === 'constructor') return

    const desc = Object.getOwnPropertyDescriptor(Getters.prototype, key)
    if (!desc || (typeof desc.value !== 'function' && !desc.get)) {
      return
    }

    options[key] = () => getters[key]
  })

  return options
}

function initMutations<S, G extends BG0, M extends BM0, A extends BA0>(
  Mutations: Class<M>,
  module: Module<S, G, M, A>
): MutationTree<any> {
  const mutations: any = new Mutations()
  mutations.__module__ = module
  const options: MutationTree<any> = {}

  Object.getOwnPropertyNames(Mutations.prototype).forEach(key => {
    if (key === 'constructor') return

    const desc = Object.getOwnPropertyDescriptor(Mutations.prototype, key)
    if (!desc || typeof desc.value !== 'function') {
      return
    }

    options[key] = (_: any, payload: any) => mutations[key](payload)
  })

  return options
}

function initActions<S, G extends BG0, M extends BM0, A extends BA0>(
  Actions: Class<A>,
  module: Module<S, G, M, A>
): MutationTree<any> {
  const actions: any = new Actions()
  actions.__module__ = module
  const options: MutationTree<any> = {}

  Object.getOwnPropertyNames(Actions.prototype).forEach(key => {
    if (key === 'constructor') return

    const desc = Object.getOwnPropertyDescriptor(Actions.prototype, key)
    if (!desc || typeof desc.value !== 'function') {
      return
    }

    options[key] = (_: any, payload: any) => actions[key](payload)
  })

  return options
}
