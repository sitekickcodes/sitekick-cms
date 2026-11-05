import type { CustomBlockComponents } from '@sitekick/blocks/react'

import { eventBlocks } from './events/frontend'

/** Renderers for the modules' page sections: `<RenderBlocks custom={customBlocks} />`. */
export const customBlocks: CustomBlockComponents = { ...eventBlocks }
