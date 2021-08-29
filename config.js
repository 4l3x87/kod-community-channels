const config = {
    telegram: {
        id: '1278615',
        hash: '49d7a16f381c008a7915f0c3796b9cb7',
        phone: '+393387759971',
        storage: 'storage/telegram.json',
        devServer: false,
        msgHistory: {
            maxMsg: 100,
            limit: 50,
        },
        getChat: {
            limit: 50
        },
    },
    dbfile: 'storage/db.json',
    chatdb: 'storage/chat.json',
    fastsubitadb: 'storage/fastsubita.db.json',
    server: 'http://kod-community-channels.herokuapp.com/fastsubita',
    // server: 'http://localhost:5000/fastsubita',
    tv_torino_url: 'https://tv.torinofc.it'
}

module.exports = config;