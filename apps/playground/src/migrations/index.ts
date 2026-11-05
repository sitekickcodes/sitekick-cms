import * as migration_20261102_234212_initial from './20261102_234212_initial';
import * as migration_20261103_170632_add_page_layout from './20261103_170632_add_page_layout';
import * as migration_20261103_172016_add_review_and_api_keys from './20261103_172016_add_review_and_api_keys';
import * as migration_20261105_210539_saved_views from './20261105_210539_saved_views';
import * as migration_20261105_230557_events_module from './20261105_230557_events_module';

export const migrations = [
  {
    up: migration_20261102_234212_initial.up,
    down: migration_20261102_234212_initial.down,
    name: '20261102_234212_initial',
  },
  {
    up: migration_20261103_170632_add_page_layout.up,
    down: migration_20261103_170632_add_page_layout.down,
    name: '20261103_170632_add_page_layout',
  },
  {
    up: migration_20261103_172016_add_review_and_api_keys.up,
    down: migration_20261103_172016_add_review_and_api_keys.down,
    name: '20261103_172016_add_review_and_api_keys',
  },
  {
    up: migration_20261105_210539_saved_views.up,
    down: migration_20261105_210539_saved_views.down,
    name: '20261105_210539_saved_views',
  },
  {
    up: migration_20261105_230557_events_module.up,
    down: migration_20261105_230557_events_module.down,
    name: '20261105_230557_events_module'
  },
];
