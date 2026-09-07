const today = (hours, minutes) => { const date = new Date(); date.setHours(hours, minutes, 0, 0); return date.toISOString(); };
const message = (id, senderId, text, hours, minutes) => ({ id, senderId, text, timestamp: today(hours, minutes) });
export const messages = {
  alex: [
    message('a1', 'alex', 'Hey Jamie! How’s your morning going? ☀️', 10, 24),
    message('a2', 'self', 'Hey! Pretty good. Finally found a quiet moment and a decent cup of coffee.', 10, 25),
    message('a3', 'self', 'How about you?', 10, 25),
    message('a4', 'alex', 'Same here! Just wrapped up a few things. I was thinking we should try that new café on Maple Street.', 10, 27),
    message('a5', 'alex', 'I’ve heard their cinnamon rolls are worth the trip 👀', 10, 27),
    message('a6', 'self', 'Coffee AND cinnamon rolls? You know me too well.', 10, 29),
    message('a7', 'self', 'How does Saturday morning sound?', 10, 29),
    message('a8', 'alex', 'Saturday sounds perfect! Shall we say 10?', 10, 31),
  ],
  sophie: [message('s1', 'self', 'Did you get a chance to look through the photos?', 9, 42), message('s2', 'sophie', 'I did! The ones from the coast are so beautiful.', 10, 15), message('s3', 'sophie', 'Sending you my favorites in a bit ✨', 10, 18)],
  marcus: [message('m1', 'marcus', 'Are we still on for a run this weekend?', 9, 30), message('m2', 'self', 'Absolutely. See you at the park!', 9, 45)],
  emma: [message('e1', 'self', 'Good luck with the presentation today!', 8, 12), message('e2', 'emma', 'Thank you! It went really well 🎉', 9, 20)],
  daniel: [message('d1', 'daniel', 'Have you listened to the playlist yet?', 8, 32), message('d2', 'self', 'This playlist is so good. On repeat!', 8, 40)],
  olivia: [message('o1', 'self', 'I can bring something for dinner.', 8, 1), message('o2', 'olivia', 'Just bring yourself. I’ve got it covered 🙂', 8, 15)],
  noah: [message('n1', 'noah', 'Found a great trail for our next hike.', 7, 40), message('n2', 'self', 'Count me in for the next one!', 7, 55)],
  isabella: [message('i1', 'self', 'How was the little bookshop you mentioned?', 7, 20), message('i2', 'isabella', 'You would love it! Let’s go together soon.', 7, 30)],
};
