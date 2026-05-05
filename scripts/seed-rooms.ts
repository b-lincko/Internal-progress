import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function seed() {
  let globalRoom = await prisma.chatRoom.findFirst({ where: { name: 'global' } })
  if (!globalRoom) {
    globalRoom = await prisma.chatRoom.create({ data: { name: 'global', type: 'Global' } })
    console.log('Created global room:', globalRoom.id)
  } else {
    console.log('Global room exists:', globalRoom.id)
  }

  const admin = await prisma.user.findFirst({ where: { email: 'admin@local' } })
  if (admin) {
    const existingMember = await prisma.chatRoomMember.findFirst({
      where: { room_id: globalRoom.id, user_id: admin.id }
    })
    if (!existingMember) {
      await prisma.chatRoomMember.create({
        data: { room_id: globalRoom.id, user_id: admin.id }
      })
      console.log('Admin added to global room')
    } else {
      console.log('Admin already in global room')
    }
  }

  await prisma.$disconnect()
}

seed().catch(console.error)
