import React from 'react'
import { useAnimatedReaction } from 'react-native-reanimated'

import { Container } from './Container'
import type {
  CollapsibleProps,
  CollapsibleRef,
  TabBarProps,
  TabName,
} from './types'

type RabbyControlledContainerProps = CollapsibleProps & {
  workletOnIndexDecimalChange?: (ctx: {
    indexDecimal: number
    tabName: TabName
  }) => void
}

const workletNoop = () => {
  'worklet'
}

const RabbyIndexDecimalReporter = React.memo(
  ({
    indexDecimal,
    tabNames,
    workletOnIndexDecimalChange,
  }: Pick<TabBarProps, 'indexDecimal' | 'tabNames'> & {
    workletOnIndexDecimalChange: NonNullable<
      RabbyControlledContainerProps['workletOnIndexDecimalChange']
    >
  }) => {
    useAnimatedReaction(
      () => {
        const value = indexDecimal.value
        const nextIndex = Math.min(
          Math.max(Math.round(value), 0),
          tabNames.length - 1
        )

        return {
          indexDecimal: value,
          tabName: tabNames[nextIndex],
        }
      },
      (ctx) => {
        if (!ctx.tabName) {
          return
        }

        workletOnIndexDecimalChange({
          indexDecimal: ctx.indexDecimal,
          tabName: ctx.tabName,
        })
      },
      [indexDecimal, tabNames, workletOnIndexDecimalChange]
    )

    return null
  }
)

export const RabbyControlledContainer = React.memo(
  React.forwardRef<CollapsibleRef, RabbyControlledContainerProps>(
    (
      {
        renderHeader,
        workletOnIndexDecimalChange = workletNoop,
        ...props
      },
      ref
    ) => {
      const renderHeaderWithReporter = React.useCallback(
        (headerProps: TabBarProps) => (
          <>
            <RabbyIndexDecimalReporter
              indexDecimal={headerProps.indexDecimal}
              tabNames={headerProps.tabNames}
              workletOnIndexDecimalChange={workletOnIndexDecimalChange}
            />
            {renderHeader?.(headerProps)}
          </>
        ),
        [renderHeader, workletOnIndexDecimalChange]
      )

      return (
        <Container
          {...props}
          ref={ref}
          renderHeader={renderHeaderWithReporter}
        />
      )
    }
  )
)
