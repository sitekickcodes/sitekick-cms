import type { CollectionConfig, CollectionSlug, Field } from 'payload'

import { adminOnly, authenticated } from '../access'
import { statusCell } from '../fields/statusCell'
import { answerEndpoint, cancelEndpoint, decideEndpoint, retryEndpoint, type ReviewEndpointOptions } from './endpoints'
import { PROPOSALS_SLUG, PROPOSAL_KINDS, PROPOSAL_STATUSES, PROPOSAL_STATUS_MAP, RUNS_SLUG, RUN_STATUSES, RUN_STATUS_MAP } from './shared'

export type ReviewCollectionOptions = {
  /** Proposals collection slug. Default `proposals`. */
  proposalsSlug?: string
  /** Runs collection slug. Default `runs`. */
  runsSlug?: string
  /** Users collection slug. Default `users`. */
  usersSlug?: string
}

const GROUP = 'Inbox'

/** The slugs an options object resolves to. */
export function reviewSlugs(options: ReviewCollectionOptions = {}): ReviewEndpointOptions {
  return {
    proposalsSlug: options.proposalsSlug ?? PROPOSALS_SLUG,
    runsSlug: options.runsSlug ?? RUNS_SLUG,
    usersSlug: options.usersSlug ?? 'users',
  }
}

/**
 * A json field the review UI owns. The raw editor is hidden because the
 * custom edit view renders the value as a diff, a timeline or a question;
 * the data still travels through the API as usual.
 */
const ownedJson = (name: string, extra: Partial<Field> = {}): Field =>
  ({ name, type: 'json', admin: { hidden: true }, ...extra }) as Field

/**
 * `proposals`: what an agent wants to change, one field at a time, with
 * receipts. Editors accept or reject per field in the review view; the
 * agents write through the Local API.
 */
export function proposalsCollection(options: ReviewCollectionOptions = {}): CollectionConfig {
  const slugs = reviewSlugs(options)
  return {
    slug: slugs.proposalsSlug,
    labels: { singular: 'Proposal', plural: 'Proposals' },
    admin: {
      useAsTitle: 'title',
      group: GROUP,
      defaultColumns: ['title', 'status', 'targetCollection', 'kind', 'agent', 'createdAt'],
      description: 'Changes an agent would like to make. Open one to accept or reject each field; nothing reaches the site until you do.',
      components: { views: { edit: { default: { Component: '@sitekick/cms/admin#ProposalReview' } } } },
    },
    access: { read: authenticated, create: authenticated, update: authenticated, delete: adminOnly },
    defaultSort: '-createdAt',
    endpoints: [decideEndpoint(slugs)],
    fields: [
      { name: 'title', type: 'text', required: true, admin: { description: 'What this proposal is about, e.g. "Enrich: Jane Doe".' } },
      {
        name: 'kind',
        type: 'select',
        options: [...PROPOSAL_KINDS],
        index: true,
        admin: { position: 'sidebar', description: 'Blank = a general edit.' },
      },
      {
        name: 'status',
        type: 'select',
        options: [...PROPOSAL_STATUSES],
        defaultValue: 'open',
        required: true,
        index: true,
        admin: {
          position: 'sidebar',
          description: 'Set by your decisions. Open until every field has one.',
          components: { Cell: statusCell(PROPOSAL_STATUS_MAP) },
        },
      },
      {
        name: 'targetCollection',
        type: 'text',
        required: true,
        index: true,
        admin: { position: 'sidebar', description: 'The collection the change belongs to.' },
      },
      {
        name: 'targetId',
        type: 'text',
        index: true,
        admin: { position: 'sidebar', description: 'Blank = a new document is created when the first field is accepted.' },
      },
      ownedJson('patch', { required: true }),
      ownedJson('decisions'),
      { name: 'summary', type: 'textarea', admin: { description: 'The agent’s own account: what it found and what it could not.' } },
      {
        name: 'run',
        type: 'relationship',
        relationTo: slugs.runsSlug as CollectionSlug,
        index: true,
        admin: { position: 'sidebar', description: 'Blank = the proposal was not produced by a run.' },
      },
      { name: 'agent', type: 'text', index: true, admin: { position: 'sidebar', description: 'Which agent proposed this, e.g. enrich@1.' } },
      {
        name: 'reviewedBy',
        type: 'relationship',
        relationTo: slugs.usersSlug as CollectionSlug,
        admin: { position: 'sidebar', readOnly: true, description: 'Blank = nobody has decided yet.' },
      },
      { name: 'reviewedAt', type: 'date', admin: { position: 'sidebar', readOnly: true, description: 'Blank = nobody has decided yet.' } },
    ],
  }
}

/**
 * `runs`: one agent job from queued to done, with the activity line, the
 * steps, a question for the editor when the agent needs one, and the cost.
 */
export function runsCollection(options: ReviewCollectionOptions = {}): CollectionConfig {
  const slugs = reviewSlugs(options)
  return {
    slug: slugs.runsSlug,
    labels: { singular: 'Run', plural: 'Runs' },
    admin: {
      useAsTitle: 'title',
      group: GROUP,
      defaultColumns: ['title', 'status', 'stage', 'kind', 'updatedAt'],
      description: 'Agent jobs, live. Open one to follow its progress, answer a question, cancel it or try again.',
      components: { views: { edit: { default: { Component: '@sitekick/cms/admin#RunReview' } } } },
    },
    access: { read: authenticated, create: authenticated, update: authenticated, delete: adminOnly },
    defaultSort: '-updatedAt',
    endpoints: [answerEndpoint(slugs), cancelEndpoint(slugs), retryEndpoint(slugs)],
    fields: [
      { name: 'title', type: 'text', required: true, admin: { description: 'What the run is doing, e.g. "Enrich: Jane Doe".' } },
      { name: 'kind', type: 'text', required: true, index: true, admin: { position: 'sidebar', description: 'The agent id, e.g. enrich@1.' } },
      {
        name: 'status',
        type: 'select',
        options: [...RUN_STATUSES],
        defaultValue: 'queued',
        required: true,
        index: true,
        admin: {
          position: 'sidebar',
          description: 'Waiting = the agent has a question for you.',
          components: { Cell: statusCell(RUN_STATUS_MAP) },
        },
      },
      { name: 'targetCollection', type: 'text', index: true, admin: { position: 'sidebar', description: 'Blank = the run is not about one document.' } },
      { name: 'targetId', type: 'text', index: true, admin: { position: 'sidebar', description: 'Blank = the run is not about one document.' } },
      ownedJson('input'),
      { name: 'stage', type: 'text', admin: { description: 'Blank = the run has not started.' } },
      { name: 'now', type: 'text', admin: { description: 'The latest activity line; updated often while running.' } },
      ownedJson('steps'),
      ownedJson('question'),
      { name: 'answer', type: 'text', admin: { description: 'Blank = no question has been answered.' } },
      { name: 'costUsd', type: 'number', min: 0, admin: { position: 'sidebar', description: 'Blank = not measured.' } },
      { name: 'attempts', type: 'number', defaultValue: 0, min: 0, admin: { position: 'sidebar', description: 'How many times a worker has picked this run up.' } },
      { name: 'leaseUntil', type: 'date', admin: { position: 'sidebar', description: 'Blank = no worker holds it.' } },
      { name: 'session', type: 'text', admin: { position: 'sidebar', description: 'Blank = the adapter did not keep a session.' } },
      { name: 'model', type: 'text', admin: { position: 'sidebar', description: 'Blank = not recorded.' } },
      { name: 'error', type: 'textarea', admin: { description: 'Blank = nothing went wrong.' } },
      {
        name: 'triggeredBy',
        type: 'relationship',
        relationTo: slugs.usersSlug as CollectionSlug,
        index: true,
        admin: { position: 'sidebar', description: 'Blank = started by a schedule or a hook.' },
      },
      {
        name: 'proposal',
        type: 'relationship',
        relationTo: slugs.proposalsSlug as CollectionSlug,
        index: true,
        admin: { position: 'sidebar', description: 'Blank = the run has not produced a proposal yet.' },
      },
    ],
  }
}
