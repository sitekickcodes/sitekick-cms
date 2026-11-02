'use client'

import type { DefaultCellComponentProps, RelationshipFieldClient, TextFieldClient } from 'payload'

import { useEffect, useMemo } from 'react'
import { RenderDefaultCell, useConfig, useListRelationships, useTranslation } from '@payloadcms/ui'
import { formatDocTitle } from '@payloadcms/ui/shared'

/**
 * List-view cell for every relationship column (wired onto each relationship
 * field by the relationshipCells convention), replacing Payload's stock one.
 *
 * The stock cell only asks for related titles once an IntersectionObserver
 * reports the cell on screen, and until then renders its empty state,
 * "<No Author>". So a row below the fold, a background tab, or any hidden
 * page (the observer never fires there) shows every relationship as missing
 * when the value is right there. This asks straight away through the same
 * batched loader (`useListRelationships`, one request per related
 * collection), says "Loading…" while it waits, and keeps the empty state for
 * rows that really have no value.
 */
type Ref = { relationTo: string; value: number | string }

const SHOWN = 3

function toRef(cell: unknown, relationTo: string | undefined): Ref | null {
  if (typeof cell === 'number' || typeof cell === 'string') {
    return relationTo ? { relationTo, value: cell } : null
  }
  if (!cell || typeof cell !== 'object') return null
  // Polymorphic: { relationTo, value }, value an id or a populated doc.
  if ('relationTo' in cell && 'value' in cell) {
    const { relationTo: to, value } = cell as { relationTo: string; value: unknown }
    return toRef(value, to)
  }
  // Populated doc (depth > 0).
  if ('id' in cell) return toRef((cell as { id: unknown }).id, relationTo)
  return null
}

export function RelationshipCell(props: DefaultCellComponentProps<RelationshipFieldClient>) {
  const { cellData, field } = props
  const relationTo = typeof field.relationTo === 'string' ? field.relationTo : undefined
  const { config, getEntityConfig } = useConfig()
  const { i18n, t } = useTranslation()
  const { documents, getRelationships } = useListRelationships()

  const all = useMemo(
    () =>
      (Array.isArray(cellData) ? cellData : [cellData]).map((cell) => toRef(cell, relationTo)).filter((ref): ref is Ref => ref !== null),
    [cellData, relationTo],
  )
  const refs = all.slice(0, SHOWN)

  // Ask only for what the shared loader hasn't seen: a REQUEST resets an entry
  // to null and refetches it, so re-asking for a loaded doc would loop.
  const missing = refs.filter((ref) => documents?.[ref.relationTo]?.[ref.value] === undefined)
  const missingKey = missing.map((ref) => `${ref.relationTo}:${ref.value}`).join(',')
  useEffect(() => {
    if (missing.length > 0) getRelationships?.(missing)
    // missingKey stands in for `missing`, a new array every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingKey, getRelationships])

  const titles = refs.map((ref) => {
    const doc = documents?.[ref.relationTo]?.[ref.value]
    const fallback = `${t('general:untitled')} - ID: ${ref.value}`
    if (doc === undefined || doc === null) return `${t('general:loading')}…`
    if (doc === false) return fallback
    return formatDocTitle({
      collectionConfig: getEntityConfig({ collectionSlug: ref.relationTo }),
      data: doc,
      dateFormat: config.admin.dateFormat,
      fallback,
      i18n,
    })
  })
  const text = titles.join(', ') + (all.length > SHOWN ? t('fields:itemsAndMore', { count: all.length - SHOWN, items: '' }) : '')

  // Hand the text back to Payload's own cell, posing as a text field, so a
  // table's first column keeps what a custom Cell otherwise loses: the link
  // to the row's doc in list views, the select button in list drawers, and
  // the pencil that opens the row in a drawer in join tables (all decided by
  // RenderDefaultCell from `link` and its table/drawer context). No refs →
  // no cellData → its "<No Author>" empty state.
  return (
    <RenderDefaultCell
      clientProps={{
        ...props,
        cellData: all.length > 0 ? text : undefined,
        field: { ...field, type: 'text' } as unknown as TextFieldClient,
      }}
      columnIndex={props.columnIndex ?? 0}
      isLinkedColumn={props.link}
    />
  )
}
