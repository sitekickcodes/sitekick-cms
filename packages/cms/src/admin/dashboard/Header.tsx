'use client'

import { useSyncExternalStore } from 'react'
import { Popup, PopupList } from '@payloadcms/ui'

import { ChevronDownIcon } from '../HelpIcons'
import styles from '../Dashboard.module.css'

const noop = () => () => {}
/** Minute-stable "now" on the client; null during the server render. */
const useNow = () => useSyncExternalStore(noop, () => Math.floor(Date.now() / 60_000), () => null)

export type CreateItem = { label: string; href: string }
export type RangeChoice = { days: number; href: string; current: boolean }

/**
 * Top of the dashboard: a greeting and today's date in the editor's own
 * clock (hence a client component), a View site link, the Create menu, and
 * the optional range switch every card reads from `?range=`.
 */
export function Header({
  subline,
  siteURL,
  create,
  ranges,
}: {
  subline?: string
  siteURL?: string
  create: CreateItem[]
  ranges?: RangeChoice[]
}) {
  const minute = useNow()
  const now = minute == null ? null : new Date(minute * 60_000)
  const hour = now?.getHours()
  const greeting = hour == null ? 'Welcome back' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const date = now?.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const current = ranges?.find((r) => r.current)

  return (
    <div className={styles.header}>
      <div className={styles.headTop}>
        <div>
          <h1 className={styles.greeting}>{greeting}</h1>
          <p className={styles.date}>{[date, subline].filter(Boolean).join(' · ') || ' '}</p>
        </div>
        <div className={styles.actions}>
          {siteURL ? (
            <a className={styles.pill} href={siteURL} target="_blank" rel="noreferrer">
              View site
            </a>
          ) : null}
          {create.length ? (
            <Popup
              horizontalAlign="right"
              size="fit-content"
              popupAriaLabel="Create"
              buttonType="custom"
              button={
                <span role="button" className={`${styles.pill} ${styles.pillPrimary} ${styles.createButton}`}>
                  Create
                  <ChevronDownIcon className={styles.chev} aria-hidden />
                </span>
              }
              render={({ close }) => (
                <PopupList.ButtonGroup>
                  {create.map((item) => (
                    <PopupList.Button key={item.href} href={item.href} onClick={close}>
                      {item.label}
                    </PopupList.Button>
                  ))}
                </PopupList.ButtonGroup>
              )}
            />
          ) : null}
        </div>
      </div>
      {ranges?.length ? (
        <div className={styles.viewBar}>
          <Popup
            size="fit-content"
            popupAriaLabel="Date range"
            buttonType="custom"
            button={
              <span role="button" className={styles.chip} aria-label={`Date range: last ${current?.days ?? ranges[0]?.days} days`}>
                <span className={styles.sweep}>
                  Last {current?.days ?? ranges[0]?.days} days
                  <ChevronDownIcon className={styles.chev} aria-hidden />
                </span>
              </span>
            }
            render={({ close }) => (
              <PopupList.RadioGroup>
                {ranges.map((r) => (
                  <PopupList.RadioGroupItem key={r.days} active={r.current} href={r.href} onClick={close}>
                    Last {r.days} days
                  </PopupList.RadioGroupItem>
                ))}
              </PopupList.RadioGroup>
            )}
          />
        </div>
      ) : null}
    </div>
  )
}
