import { DocPage } from './DocPage'
import { pageFor } from '@/lib/docs'

export default function Home() {
  return <DocPage page={pageFor('')!} />
}
