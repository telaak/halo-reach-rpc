const memoryjs = require('memoryjs');
const processName = 'MCC-Win64-Shipping-WinStore.exe';
const util = require('util');
const client = require('discord-rich-presence')('651555435857444885');

const processObject = memoryjs.openProcess(processName);
const moduleObject = memoryjs.findModule(
  'haloreach.dll',
  processObject.th32ProcessID
);
const asyncReadMemory = util.promisify(memoryjs.readMemory);
const asyncReadBuffer = util.promisify(memoryjs.readBuffer);

const levels = {
  178: {
    name: 'Noble Actual',
    description: 'Welcome to Reach.'
  },
  179: {
    name: 'Winter Contingency',
    description: "There's a disturbance on the frontier."
  },
  180: {
    name: 'ONI: Sword Base',
    description:
      'Covenant are attacking a vital ONI base. Drive the bastards off.'
  },
  181: {
    name: 'Nightfall',
    description: 'Move in behind enemy lines and evaluate the opposition.'
  },
  182: {
    name: 'Tip of The Spear',
    description:
      'Two massive armies clash! Time to go to war against the Covenant.'
  },
  183: {
    name: 'Long Night of Solace',
    description:
      'Move up the beach and secure the launch facility. Take the battle to the Covenant Super Carrier.'
  },
  184: {
    name: 'Exodus',
    description: 'All is not lost. Evacuate civilians from an occupied city.'
  },
  185: {
    name: 'New Alexandria',
    description: 'Provide air support in a forest of crumbling skyscrapers.'
  },
  186: {
    name: 'The Package',
    description: 'Your orders are to destroy Sword Base... Or are they?'
  },
  187: {
    name: 'The Pillar of Autumn',
    description: "Deliver Halsey's data package to the Pillar of Autumn."
  },
  188: {
    name: 'Lone Wolf',
    description: "Spartans never die. They're just missing in action..."
  }
};

const difficulties = {
  0: {
    name: 'Easy',
    description:
      'Your foes cower and fall before your unstoppable onslaught, yet final victory will leave you wanting more.'
  },
  1: {
    name: 'Normal',
    description:
      'Hordes of aliens vie to destroy you, but nerves of steel and a quick trigger finger give you a solid chance to prevail.'
  },
  2: {
    name: 'Heroic',
    description:
      'Your enemies are as numerous as they are ferocious; their attacks are devastating. Survival is not guaranteed.'
  },
  3: {
    name: 'Legendary',
    description:
      'Your enemies outnumber you greatly and are hunting you down. Can you survive their onslaught?'
  }
};

const readPointer = (address, type = 'int64') => {
  return asyncReadMemory(processObject.handle, address, type);
};

const getLobbyGamePointer = async () => {
  const basePtr = await readPointer(processObject.modBaseAddr + 0x037414e8);
  const firstPtr = await readPointer(basePtr + 0x8);
  const secondPtr = await readPointer(firstPtr + 0x78);
  const thirdPtr = await readPointer(secondPtr + 0x20);
  return thirdPtr;
};

const getLobbyDifficulty = async () => {
  const gamePtr = await getLobbyGamePointer();
  const firstPtr = await readPointer(gamePtr + 0x2a0);
  const difficulty = await readPointer(firstPtr + 0x400, 'int32');
  return difficulty;
};

const getLobbyLevel = async () => {
  const gamePtr = await getLobbyGamePointer();
  const firstPtr = await readPointer(gamePtr + 0x30);
  const level = await readPointer(firstPtr + 0x6c0, 'int32');
  return level;
};

const getLevel = async () => {
  return readPointer(moduleObject.modBaseAddr + 0x250cae4, 'int32');
};

const getDifficulty = async () => {
  return readPointer(moduleObject.modBaseAddr + 0x250cae8, 'int32');
};

const buildPayload = (
  levelName,
  difficultyName,
  levelDescription,
  difficultyDescription,
  startTime = null
) => {
  let payload = {
    details: levelName,
    state: difficultyName,
    largeImageKey: levelName.replace(/[\s:]/g, '_').toLowerCase(),
    largeImageText: levelDescription,
    smallImageKey: difficultyName.toLowerCase(),
    smallImageText: difficultyDescription,
    startTimestamp: startTime
  };
  return payload;
};

const updateRPC = async () => {
  const status = await getStatus();
  client.updatePresence(status);
};

const getStatus = async () => {
  // const difficulty = await getDifficulty().then(difficultyNumber => difficulties[difficultyNumber])
  // const level = await getLevel().then(levelNumber => levels[levelNumber])

  const status = await asyncReadBuffer(
    processObject.handle,
    moduleObject.modBaseAddr + 0x27b84b0,
    256
  ).then(buffer => buffer.toString('utf16le'));
  if (status.includes('on')) {
    const levelName = status.substr(0, status.indexOf(' on '));
    const difficultyName = status.slice(
      status.indexOf(' on ') + 4,
      status.indexOf(',')
    );
    const levelDescription = Object.values(levels).find(
      lvl => lvl.name === levelName
    ).description;
    const difficultyDescription = Object.values(difficulties).find(
      diff => diff.name === difficultyName
    ).description;
    const startTime = new Date(status.slice(status.indexOf(',')));
    return buildPayload(
      levelName,
      difficultyName,
      levelDescription,
      difficultyDescription,
      startTime
    );
  } else {
    const levelNumber = await getLobbyLevel();
    const difficultyNumber = await getLobbyDifficulty();
    const level = levels[levelNumber];
    const difficulty = difficulties[difficultyNumber];
    return buildPayload(
      level.name,
      difficulty.name,
      level.description,
      difficulty.description
    );
  }
};

setTimeout(() => {
  updateRPC();
}, 15000);
