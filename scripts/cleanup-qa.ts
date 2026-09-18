import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const email = 'uiqa@test.com'
  const u = await p.user.findUnique({ where: { email } })
  if (!u) { console.log('uiqa user not found (already clean)'); return }
  await p.user.delete({ where: { email } })
  console.log(`Deleted uiqa user ${u.id} + cascade rows`)
  const total = await p.user.count()
  console.log(`Total users now: ${total}`)
}
main().finally(() => p.$disconnect())
