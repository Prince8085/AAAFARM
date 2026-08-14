import { DATA_SOURCE } from '../config'
import { apiRepo } from './apiRepo'
import { localRepo } from './localRepo'
import type { DataRepo } from './types'

/** Active repository — flip DATA_SOURCE in src/config.ts to switch. */
export const repo: DataRepo = DATA_SOURCE === 'api' ? apiRepo : localRepo
