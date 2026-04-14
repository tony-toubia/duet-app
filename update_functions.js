const fs = require('fs');
const path = 'firebase/functions/src/index.ts';
let code = fs.readFileSync(path, 'utf8');

const hook = `
/**
 * Room Membership Capacity Constraint
 */
export const onRoomMemberAdded = onValueCreated(
  { ref: '/rooms/{roomCode}/members/{userId}', region: 'us-central1' },
  async (event) => {
    const roomCode = event.params.roomCode;
    const userId = event.params.userId;
    
    const roomSnap = await event.data.ref.parent.parent.once('value');
    if (!roomSnap.exists()) return;
    
    const room = roomSnap.val();
    if (room.roomType === 'party') {
       const memberCount = Object.keys(room.members || {}).length;
       if (memberCount > (room.maxParticipants || 6)) {
          console.warn('Room maxed out, ejecting ' + userId);
          await event.data.ref.remove();
       }
    }
  }
);
`;

if (!code.includes('onRoomMemberAdded')) {
  code = code + '\n' + hook;
  fs.writeFileSync(path, code);
  console.log('Added onRoomMemberAdded hook');
} else {
  console.log('Hook already exists');
}
