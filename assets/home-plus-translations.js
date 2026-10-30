(()=>{const rows=[
['CADA JUEGO, OTRA POSIBILIDAD','EVERY GAME, ANOTHER POSSIBILITY','CADA JOGO, OUTRA POSSIBILIDADE','CHAQUE JEU, UNE AUTRE POSSIBILITÉ'],
['Tu biblioteca.','Your library.','Sua biblioteca.','Votre bibliothèque.'],
['Muchos mundos.','Many worlds.','Muitos mundos.','De nombreux mondes.'],
['Del oeste a tu próxima construcción. Modoker reúne el espacio de tus juegos y te deja elegir cómo volver a cada uno.','From the Wild West to your next build. Modoker brings your games together and lets you choose how to return to each one.','Do Velho Oeste à sua próxima construção. Modoker reúne seus jogos e deixa você escolher como voltar a cada um.','Du Far West à votre prochaine construction. Modoker réunit vos jeux et vous laisse choisir comment retrouver chacun d’eux.'],
['Pausar carrusel','Pause carousel','Pausar carrossel','Mettre en pause'],
['Reanudar carrusel','Resume carousel','Retomar carrossel','Reprendre le carrousel'],
['Tu espacio para jugar a tu manera. Capturas de la app con datos de demostración.','Your space to play your way. App screenshots with demonstration data.','Seu espaço para jogar do seu jeito. Capturas do app com dados de demonstração.','Votre espace pour jouer à votre façon. Captures de l’application avec des données de démonstration.'],
['Guarda varios perfiles de mods para el mismo juego. Ligero, supervivencia o tu propia mezcla.','Save multiple mod profiles for the same game. Lightweight, survival, or your own mix.','Salve vários perfis de mods para o mesmo jogo. Leve, sobrevivência ou sua própria combinação.','Enregistrez plusieurs profils de mods pour un même jeu. Léger, survie ou votre propre sélection.']
];for(const row of rows)for(const [i,lang] of ['en','pt-BR','fr'].entries())Object.assign(window.ModokerLocales[lang]??={},{[row[0]]:row[i+1]});})();
