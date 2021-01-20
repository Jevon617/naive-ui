import {
  h,
  ref,
  computed,
  toRef,
  defineComponent,
  PropType,
  nextTick,
  ComputedRef,
  watch,
  Transition,
  withDirectives
} from 'vue'
import { createTreeMate } from 'treemate'
import { VBinder, VFollower, VTarget, FollowerRef } from 'vueuc'
import { useIsMounted, useMergedState, useCompitable } from 'vooks'
import { clickoutside } from 'vdirs'
import { useTheme, useConfig, useLocale, useFormItem } from '../../_mixins'
import type { ThemeProps } from '../../_mixins'
import { warn, call, useAdjustedTo, MaybeArray } from '../../_utils'
import { NBaseSelectMenu, NBaseSelection, BaseSelectMenuRef } from '../../_base'
import type { BaseSelectionRef } from '../../_base'
import { selectLight, SelectTheme } from '../styles'
import {
  tmOptions,
  patternMatched,
  createValOptMap,
  filterOptions
} from './utils'
import style from './styles/index.cssr'

import type {
  Options,
  Option,
  BaseOption,
  GroupOption,
  IgnoredOption
} from './interface'

export default defineComponent({
  name: 'Select',
  props: {
    ...(useTheme.props as ThemeProps<SelectTheme>),
    bordered: {
      type: Boolean,
      default: undefined
    },
    clearable: {
      type: Boolean,
      default: false
    },
    options: {
      type: Array as PropType<Options>,
      required: true
    },
    defaultValue: {
      type: [String, Number, Array] as PropType<
      string | number | Array<string | number> | null
      >,
      default: null
    },
    value: {
      type: [String, Number, Array] as PropType<
      string | number | Array<string | number> | undefined
      >,
      default: undefined
    },
    placeholder: {
      type: String,
      default: undefined
    },
    multiple: {
      type: Boolean,
      default: false
    },
    size: {
      type: String as PropType<'small' | 'medium' | 'large'>,
      default: undefined
    },
    filterable: {
      type: Boolean,
      default: false
    },
    disabled: {
      type: Boolean,
      default: false
    },
    remote: {
      type: Boolean,
      default: false
    },
    loading: {
      type: Boolean,
      default: false
    },
    filter: {
      type: Function as PropType<(pattern: string, option: Option) => boolean>,
      default: (pattern: string, option: Option) => {
        if (!option) return false
        if (option.label !== undefined) {
          return patternMatched(pattern, option.label)
        } else if (option.value !== undefined) {
          return patternMatched(pattern, String(option.value))
        }
        return false
      }
    },
    placement: {
      type: String,
      default: 'bottom-start'
    },
    widthMode: {
      type: String,
      default: 'trigger'
    },
    tag: {
      type: Boolean,
      default: false
    },
    onCreate: {
      type: Function as PropType<(label: string) => BaseOption>,
      default: (label: string) => ({
        label: label,
        value: label
      })
    },
    fallbackOption: {
      type: [Function, Boolean] as PropType<
      (value: string | number) => BaseOption | false
      >,
      default: () => (value: string | number) => ({
        label: String(value),
        value
      })
    },
    show: {
      type: Boolean,
      default: undefined
    },
    // eslint-disable-next-line vue/prop-name-casing
    'onUpdate:value': {
      type: [Function, Array] as PropType<
      MaybeArray<(value: string | number | null) => void> | undefined
      >,
      default: undefined
    },
    onBlur: {
      type: [Function, Array] as PropType<
      MaybeArray<(e: FocusEvent) => void> | undefined
      >,
      default: undefined
    },
    onFocus: {
      type: [Function, Array] as PropType<
      MaybeArray<(e: FocusEvent) => void> | undefined
      >,
      default: undefined
    },
    onScroll: {
      type: [Function, Array] as PropType<
      MaybeArray<(e: Event) => void> | undefined
      >,
      default: undefined
    },
    onSearch: {
      type: [Function, Array] as PropType<
      MaybeArray<(value: string) => void> | undefined
      >,
      default: undefined
    },
    /** deprecated */
    onChange: {
      type: [Function, Array] as PropType<
      MaybeArray<(value: string | number | null) => void> | undefined
      >,
      validator: () => {
        if (__DEV__) {
          warn(
            'select',
            '`on-change` is deprecated, please use `on-update:value` instead.'
          )
        }
        return true
      },
      default: undefined
    },
    items: {
      type: Array as PropType<Options | undefined>,
      validator: () => {
        if (__DEV__) {
          warn('select', '`items` is deprecated, please use `options` instead.')
        }
        return true
      },
      default: undefined
    },
    autofocus: {
      type: Boolean,
      default: false
    }
  },
  setup (props) {
    const themeRef = useTheme('Select', 'Select', style, selectLight, props)
    const uncontrolledValueRef = ref(props.defaultValue)
    const controlledValueRef = toRef(props, 'value')
    const mergedValueRef = useMergedState(
      controlledValueRef,
      uncontrolledValueRef
    )
    const patternRef = ref('')
    const treeMateRef = computed(() =>
      createTreeMate<BaseOption, GroupOption, IgnoredOption>(
        filteredOptionsRef.value,
        tmOptions
      )
    )
    const valOptMapRef = computed(() => createValOptMap(props.options))
    const uncontrolledShowRef = ref(false)
    const mergedShowRef = useMergedState(
      toRef(props, 'show'),
      uncontrolledShowRef
    )
    const triggerRef = ref<BaseSelectionRef | null>(null)
    const followerRef = ref<FollowerRef | null>(null)
    const menuRef = ref<BaseSelectMenuRef | null>(null)
    const { locale } = useLocale('Select')
    const localizedPlaceholderRef = computed<string>(() => {
      return props.placeholder ?? locale.value.placeholder
    })
    const compitableOptionsRef = useCompitable(props, [
      'items',
      'options'
    ]) as ComputedRef<Options>

    const createdOptionsRef = ref<BaseOption[]>([])
    const beingCreatedOptionsRef = ref<BaseOption[]>([])
    const memoValOptMapRef = ref(new Map<string | number, BaseOption>())

    const wrappedFallbackOptionRef = computed(() => {
      const { fallbackOption } = props
      if (!fallbackOption) return false
      return (value: string | number) => {
        return Object.assign(fallbackOption(value), { value }) as BaseOption
      }
    })
    const localOptionsRef = computed<Options>(() => {
      return (beingCreatedOptionsRef.value.concat(
        createdOptionsRef.value
      ) as Options).concat(compitableOptionsRef.value)
    })
    const filteredOptionsRef = computed(() => {
      if (props.remote) {
        return compitableOptionsRef.value
      } else {
        const { value: localOptions } = localOptionsRef
        const { value: pattern } = patternRef
        if (!pattern.length || !props.filterable) {
          return localOptions
        } else {
          const { filter } = props
          return filterOptions(localOptions, filter, pattern)
        }
      }
    })
    const selectedOptionsRef = computed(() => {
      if (props.multiple) {
        const { value: values } = mergedValueRef
        if (!Array.isArray(values)) return []
        const remote = props.remote
        const { value: memoValOptMap } = memoValOptMapRef
        const { value: valOptMap } = valOptMapRef
        const { value: wrappedFallbackOption } = wrappedFallbackOptionRef
        const options: BaseOption[] = []
        values.forEach((value) => {
          if (valOptMap.has(value)) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            options.push(valOptMap.get(value)!)
          } else if (remote && memoValOptMap.has(value)) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            options.push(memoValOptMap.get(value)!)
          } else if (wrappedFallbackOption) {
            const option = wrappedFallbackOption(value)
            if (option) {
              options.push(option)
            }
          }
        })
        return options
      }
      return null
    })
    const selectedOptionRef = computed<BaseOption | null>(() => {
      const { value: mergedValue } = mergedValueRef
      if (!props.multiple && !Array.isArray(mergedValue)) {
        const { value: valOptMap } = valOptMapRef
        const { value: wrappedFallbackOption } = wrappedFallbackOptionRef
        if (mergedValue === null) return null
        let selectedOption = null
        if (valOptMap.has(mergedValue as any)) {
          selectedOption = valOptMap.get(mergedValue)
        } else if (props.remote) {
          selectedOption = memoValOptMapRef.value.get(mergedValue)
        }
        return (
          selectedOption ||
          // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
          (wrappedFallbackOption && wrappedFallbackOption(mergedValue)) ||
          null
        )
      }
      return null
    })

    const formItem = useFormItem(props)
    function doUpdateValue (
      value: string | number | Array<string | number> | null
    ): void {
      const { onChange, 'onUpdate:value': onUpdateValue } = props
      const { nTriggerFormChange, nTriggerFormInput } = formItem
      if (onChange) call(onChange, value)
      if (onUpdateValue) call(onUpdateValue, value)
      uncontrolledValueRef.value = value
      nTriggerFormChange()
      nTriggerFormInput()
    }
    function doBlur (e: FocusEvent): void {
      const { onBlur } = props
      const { nTriggerFormBlur } = formItem
      if (onBlur) call(onBlur, e)
      nTriggerFormBlur()
    }
    function doFocus (e: FocusEvent): void {
      const { onFocus } = props
      const { nTriggerFormFocus } = formItem
      if (onFocus) call(onFocus, e)
      nTriggerFormFocus()
    }
    function doSearch (value: string): void {
      const { onSearch } = props
      if (onSearch) call(onSearch, value)
    }
    function doScroll (e: Event): void {
      const { onScroll } = props
      if (onScroll) call(onScroll, e)
    }
    // remote related methods
    function updateMemorizedOptions (): void {
      const { remote, multiple } = props
      if (remote) {
        const { value: memoValOptMap } = memoValOptMapRef
        if (multiple) {
          selectedOptionsRef.value?.forEach((option) => {
            memoValOptMap.set(option.value, option)
          })
        } else {
          const option = selectedOptionRef.value
          if (option) {
            memoValOptMap.set(option.value, option)
          }
        }
      }
    }
    // menu related methods
    function openMenu (): void {
      if (!props.disabled) {
        patternRef.value = ''
        uncontrolledShowRef.value = true
        if (props.filterable) {
          triggerRef.value?.focusPatternInput()
        }
      }
    }
    function closeMenu (): void {
      uncontrolledShowRef.value = false
    }
    function handleMenuLeave (): void {
      patternRef.value = ''
    }
    function handleTriggerClick (): void {
      if (props.disabled) return
      if (!mergedShowRef.value) {
        openMenu()
      } else {
        if (!props.filterable) {
          closeMenu()
        }
      }
    }
    function handleTriggerBlur (e: FocusEvent): void {
      doBlur(e)
      closeMenu()
    }
    function handleTriggerFocus (e: FocusEvent): void {
      doFocus(e)
    }
    function handleMenuClickOutside (e: MouseEvent): void {
      if (mergedShowRef.value) {
        if (!triggerRef.value?.$el.contains(e.target as Node)) {
          closeMenu()
        }
      }
    }
    function createClearedMultipleSelectValue (
      value: string | number | Array<string | number> | null
    ): Array<string | number> {
      if (!Array.isArray(value)) return []
      if (wrappedFallbackOptionRef.value) {
        // if option has a fallback, I can't help user to clear some unknown value
        return Array.from(value)
      } else {
        // if there's no option fallback, unappeared options are treated as invalid
        const { remote } = props
        const { value: valOptMap } = valOptMapRef
        if (remote) {
          const { value: memoValOptMap } = memoValOptMapRef
          return value.filter((v) => valOptMap.has(v) || memoValOptMap.has(v))
        } else {
          return value.filter((v) => valOptMap.has(v))
        }
      }
    }
    function handleToggleOption (option: BaseOption): void {
      if (props.disabled) return
      const { tag, remote } = props
      if (tag && !remote) {
        const { value: beingCreatedOptions } = beingCreatedOptionsRef
        const beingCreatedOption = beingCreatedOptions[0] || null
        if (beingCreatedOption) {
          createdOptionsRef.value.push(beingCreatedOption)
          beingCreatedOptionsRef.value = []
        }
      }
      if (remote) {
        memoValOptMapRef.value.set(option.value, option)
      }
      if (props.multiple) {
        const changedValue = createClearedMultipleSelectValue(
          mergedValueRef.value
        )
        const index = changedValue.findIndex((value) => value === option.value)
        if (~index) {
          changedValue.splice(index, 1)
          if (tag && !remote) {
            const createdOptionIndex = getCreatedOptionIndex(option.value)
            if (~createdOptionIndex) {
              createdOptionsRef.value.splice(createdOptionIndex, 1)
              patternRef.value = ''
            }
          }
        } else {
          changedValue.push(option.value)
          patternRef.value = ''
        }
        doUpdateValue(changedValue)
      } else {
        if (tag && !remote) {
          const createdOptionIndex = getCreatedOptionIndex(option.value)
          if (~createdOptionIndex) {
            createdOptionsRef.value = [
              createdOptionsRef.value[createdOptionIndex]
            ]
          } else {
            createdOptionsRef.value = []
          }
        }
        if (props.filterable && !props.multiple) {
          returnFocusToWrapper()
        }
        closeMenu()
        doUpdateValue(option.value)
      }
    }
    function handleDeleteLastOption (): void {
      if (!patternRef.value.length) {
        const changedValue = createClearedMultipleSelectValue(
          mergedValueRef.value
        )
        if (Array.isArray(changedValue)) {
          const poppedValue = changedValue.pop()
          if (poppedValue === undefined) return
          const createdOptionIndex = getCreatedOptionIndex(poppedValue)
          ~createdOptionIndex &&
            createdOptionsRef.value.splice(createdOptionIndex, 1)
          doUpdateValue(changedValue)
        }
      }
    }
    function getCreatedOptionIndex (optionValue: string | number): number {
      const createdOptions = createdOptionsRef.value
      return createdOptions.findIndex(
        (createdOption) => createdOption.value === optionValue
      )
    }
    function handlePatternInput (e: InputEvent): void {
      const { value } = (e.target as unknown) as HTMLInputElement
      patternRef.value = value
      const { tag, remote } = props
      doSearch(value)
      if (tag && !remote) {
        if (!value) {
          beingCreatedOptionsRef.value = []
          return
        }
        const optionBeingCreated = props.onCreate(value)
        if (
          compitableOptionsRef.value.some(
            (option) => option.value === optionBeingCreated.value
          ) ||
          createdOptionsRef.value.some(
            (option) => option.value === optionBeingCreated.value
          )
        ) {
          beingCreatedOptionsRef.value = []
        } else {
          beingCreatedOptionsRef.value = [optionBeingCreated]
        }
      }
    }
    function handleClear (e: MouseEvent): void {
      e.stopPropagation()
      const { multiple } = props
      if (!multiple && props.filterable) {
        closeMenu()
      }
      if (multiple) {
        doUpdateValue([])
      } else {
        doUpdateValue(null)
      }
    }
    // scroll events on menu
    function handleMenuScroll (e: Event): void {
      doScroll(e)
    }
    // keyboard events
    function handleKeyUp (e: KeyboardEvent): void {
      switch (e.code) {
        case 'Space':
          if (props.filterable) break
        // eslint-disable-next-line no-fallthrough
        case 'Enter':
          if (mergedShowRef.value) {
            const menu = menuRef.value
            const pendingOptionData = menu?.getPendingOption()
            if (pendingOptionData) {
              handleToggleOption(pendingOptionData)
            } else {
              closeMenu()
              returnFocusToWrapper()
            }
          } else {
            openMenu()
          }
          e.preventDefault()
          break
        case 'ArrowUp':
          if (props.loading) return
          if (mergedShowRef.value) {
            menuRef.value?.prev()
          }
          break
        case 'ArrowDown':
          if (props.loading) return
          if (mergedShowRef.value) {
            menuRef.value?.next()
          }
          break
        case 'Escape':
          closeMenu()
          triggerRef.value?.focusPatternInputWrapper()
          break
      }
    }
    function handleKeyDown (e: KeyboardEvent): void {
      switch (e.code) {
        case 'Space':
          if (!props.filterable) {
            e.preventDefault()
          }
          break
        case 'ArrowUp':
        case 'ArrowDown':
          e.preventDefault()
          break
      }
    }
    function returnFocusToWrapper (): void {
      triggerRef.value?.focusPatternInputWrapper()
    }
    function syncPosition (): void {
      followerRef.value?.syncPosition()
    }
    updateMemorizedOptions()
    watch(toRef(props, 'options'), updateMemorizedOptions)
    watch(filteredOptionsRef, () => {
      if (!mergedShowRef.value) return
      void nextTick(syncPosition)
    })
    watch(mergedValueRef, () => {
      if (!mergedShowRef.value) return
      void nextTick(syncPosition)
    })
    return {
      ...useConfig(props),
      treeMate: treeMateRef,
      isMounted: useIsMounted(),
      triggerRef,
      menuRef,
      pattern: patternRef,
      uncontrolledShow: uncontrolledShowRef,
      mergedShow: mergedShowRef,
      adjustedTo: useAdjustedTo(props),
      uncontrolledValue: uncontrolledValueRef,
      mergedValue: mergedValueRef,
      followerRef,
      localizedPlaceholder: localizedPlaceholderRef,
      selectedOption: selectedOptionRef,
      selectedOptions: selectedOptionsRef,
      mergedSize: formItem.mergedSize,
      handleTriggerClick,
      handleDeleteLastOption,
      handleToggleOption,
      handlePatternInput,
      handleClear,
      handleTriggerBlur,
      handleTriggerFocus,
      handleKeyDown,
      handleKeyUp,
      syncPosition,
      handleMenuLeave,
      handleMenuClickOutside,
      handleMenuScroll,
      mergedTheme: themeRef
    }
  },
  render () {
    const { $slots } = this
    return (
      <div class="n-select">
        <VBinder>
          {{
            default: () => [
              <VTarget>
                {{
                  default: () => (
                    <NBaseSelection
                      ref="triggerRef"
                      bordered={this.mergedBordered}
                      active={this.mergedShow}
                      pattern={this.pattern}
                      placeholder={this.localizedPlaceholder}
                      selectedOption={this.selectedOption}
                      selectedOptions={this.selectedOptions}
                      multiple={this.multiple}
                      filterable={this.filterable}
                      remote={this.remote}
                      clearable={this.clearable}
                      disabled={this.disabled}
                      size={this.mergedSize}
                      unstableTheme={this.mergedTheme.peers.BaseSelection}
                      unstableThemeOverrides={
                        this.mergedTheme.overrides.BaseSelection
                      }
                      loading={this.loading}
                      autofocus={this.autofocus}
                      onClick={this.handleTriggerClick}
                      onDeleteLastOption={this.handleDeleteLastOption}
                      onDeleteOption={this.handleToggleOption}
                      onPatternInput={this.handlePatternInput}
                      onClear={this.handleClear}
                      onBlur={this.handleTriggerBlur}
                      onFocus={this.handleTriggerFocus}
                      onKeydown={this.handleKeyDown}
                      onKeyup={this.handleKeyUp}
                    />
                  )
                }}
              </VTarget>,
              <VFollower
                ref="followerRef"
                show={this.mergedShow}
                to={this.adjustedTo}
                containerClass="namespace"
                width="target"
                placement="bottom-start"
              >
                {{
                  default: () => (
                    <Transition
                      name="n-fade-in-scale-up-transition"
                      appear={this.isMounted}
                      onLeave={this.handleMenuLeave}
                    >
                      {{
                        default: () =>
                          this.mergedShow &&
                          withDirectives(
                            h(
                              NBaseSelectMenu,
                              {
                                ref: 'menuRef',
                                class: 'n-select-menu',
                                autoPending: true,
                                unstableTheme: this.mergedTheme.peers
                                  .BaseSelectMenu,
                                unstableThemeOverrides: this.mergedTheme
                                  .overrides.BaseSelectMenu,
                                pattern: this.pattern,
                                treeMate: this.treeMate,
                                multiple: this.multiple,
                                size: 'medium',
                                value: this.mergedValue,
                                onMenuToggleOption: this.handleToggleOption,
                                onScroll: this.handleMenuScroll
                              },
                              $slots
                            ),
                            [[clickoutside, this.handleMenuClickOutside]]
                          )
                      }}
                    </Transition>
                  )
                }}
              </VFollower>
            ]
          }}
        </VBinder>
      </div>
    )
  }
})
