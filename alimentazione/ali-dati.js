/* Mr. 9 Training · Alimentazione · PIANO D'ESEMPIO (inventato)
 * Il piano vero è privato: sta nel repository dati come "alimentazione/piano.json"
 * e l'app lo legge con window.Mr9Dati.leggi (vedi ali.js, caricaPiano).
 * Questo file serve solo quando il repository dati non è collegato.
 */
(function () {
  'use strict';
  window.Mr9AliPianoEsempio = {
    versione: 'Esempio',
    stato: 'esempio',
    avviso: 'Piano d\'esempio: collega il repository dati per vedere il tuo.',
    nonPiacciono: [],
    verduraCotta: ['carote', 'spinaci', 'fagiolini'],
    settimana: ['riposo', 'allenamento', 'riposo', 'allenamento', 'riposo', 'allenamento', 'riposo'],
    tipi: {
      allenamento: {
        nome: 'Giorno di allenamento', breve: 'Allenamento', colore: 'var(--fisico, #ff6a3d)', kcal: '', prot: '',
        pasti: [
          { id: 'colazione', nome: 'Colazione', ora: '7:30', ingredienti: [['yogurt', 150], ['fiocchi d\'avena', 50], ['banana', 100]] },
          { id: 'pranzo', nome: 'Pranzo', ora: '13:00', ingredienti: [['pasta', 100], ['pollo', 120], ['verdura cotta', 200], ['olio extravergine', 10]] },
          { id: 'spuntino', nome: 'Spuntino', ora: '17:00', preApnea: true, ingredienti: [['pane', 60], ['prosciutto cotto', 40]] },
          { id: 'cena', nome: 'Cena', ora: '20:30', ingredienti: [['riso', 80], ['merluzzo', 150], ['verdura cotta', 200], ['olio extravergine', 10]] }
        ]
      },
      riposo: {
        nome: 'Giorno di riposo', breve: 'Riposo', colore: 'var(--cibo, #2ee59d)', kcal: '', prot: '',
        pasti: [
          { id: 'colazione', nome: 'Colazione', ora: '8:00', ingredienti: [['yogurt', 150], ['frutta', 150]] },
          { id: 'pranzo', nome: 'Pranzo', ora: '13:00', ingredienti: [['riso', 80], ['uova', 120], ['verdura cotta', 200], ['olio extravergine', 10]] },
          { id: 'cena', nome: 'Cena', ora: '20:30', ingredienti: [['patate', 250], ['tacchino', 120], ['verdura cotta', 200], ['olio extravergine', 10]] }
        ]
      }
    },
    pezzo: { 'uova': 60, 'banana': 100 }
  };
})();
