const express = require("express");
const PORT = process.env.PORT || 5000
const path = require("path");
const db = require("./utils/db");
const config = require("./config");
const request = require("request");
const cheerio = require("cheerio");
const app = express()
    .use(express.static(path.join(__dirname, 'public')))
    .use(express.json())
    .set('views', path.join(__dirname, 'views'))
    .set('view engine', 'ejs')

app.listen(PORT, () => console.log(`Listening on ${PORT}`))

app.post('/fastsubita', async (req, res) => {
    let data = [], countMessages = 0

    if (req.body.last_message_id) {
        let last_message_id = parseInt(req.body.last_message_id)
        db.updateLastMsgId(last_message_id)
        return res.json({last_message_id: last_message_id})
    }


    try {
        req.body.forEach(item => {
            if (item._ == 'message') {
                // if(item.message.indexOf('SWAT') === -1) return
                // console.log(item)
                // return
                const regex = new RegExp(/^(?<serie>.*)\s(?<season>[0-9]+)\s?(?:X|×|x)(?<episode>[0-9]+)\s*(?:"(?<title>[^"]+)")?.*$/img);
                const found = [...item.message.matchAll(regex)]
                console.log(found)

                if(found){
                    found.forEach((match, index) => {
                        let message = ''
                        let start = item.message.indexOf(match[0]);
                        message = item.message.substr(start)
                        if(found[index + 1]){
                            let end = item.message.indexOf(found[index + 1][0]);
                            message = item.message.substr(start, end)
                        }
                        message = message.replace(/ \n/gi,'\n')

                        const links = [...message.matchAll(new RegExp(/^(https?:\/\/\S*)$/img))]
                        // console.log(links)
                        if (links) {
                            let episode = {
                                message_id: item.id,
                                message_date: item.date,
                                serie: match.groups['serie'],
                                season: match.groups['season'],
                                episode: match.groups['episode'],
                                title: match.groups['title'] ? match.groups['title'] : null,
                                links: []
                            }
                            for (const link of links) {
                                if(!link[0].match(/netu_|kat_/i))
                                    episode.links.push(link[0])
                            }
                            // console.log(episode)
                            data.push(episode)
                        }
                    })
                }
                    // console.log(item.message)
            }

        })
        countMessages = req.body.length
    } catch (e) {

    }
    // console.log(data)


    let status = data.length > 0;
    if (status) {
        let items = []
        let d = new Date()
        const lastTime = d.setMonth(d.getMonth() - 2)
        try {
            const readFile = await db.readDb(config.fastsubitadb);
            items = JSON.parse(readFile)
        } catch (err) {
            console.log("file not found so making a empty one and adding default value " + err)
        }

        items = items.concat(data)
        items = [...new Map(items.map(item => [item.message_id, item])).values()]
            .sort((a, b) => {
                if (a.message_date > b.message_date) return 1
                if (a.message_date === b.message_date) return 0
                if (a.message_date < b.message_date) return -1
            })
        items.filter(item => item.message_date >= lastTime)
        try {
            await db.writeFile(items, config.fastsubitadb)
        } catch (err) {
            console.log("error, couldnt save to file " + err)
        }
    }

    res.json({
        status: status,
        countMessages: countMessages,
        count: data.length,
        // data: data
    })
})

app.get('/', (req, res) => {
    let base_url = req.protocol + '://' + req.get('host');
    res.json({
        name: 'KOD Community Channels by 4l3x87',
        channels: [
            {
                title: 'Torino Channel',
                link: base_url + '/torino-channel'
            },
            {
                title: 'FastSubIta',
                link: base_url + '/fastsubita'
            }
        ]
    })
})
app.get('/fastsubita', async (req, res) => {
    let list = {},
        channel = {},
        base_url = req.protocol + '://' + req.get('host')


    let response = {
        channel_name: 'FastSubIta',
        generic_list: []
    }
    try {
        const readFile = await db.readDb('storage/fastsubita.db.json');
        const items = JSON.parse(readFile)

        items.sort((a, b) => {
            if (a.message_date > b.message_date) return -1
            if (a.message_date === b.message_date) return 0
            if (a.message_date < b.message_date) return 1
        }).forEach(item => {
            let listItem = {
                title: item.serie + " " + item.season + "x" + item.episode,
                videolibrary: false,
                find_links: []
            }

            if (item.title) listItem.title += " \"" + item.title + "\""

            for (const link of item.links)
                listItem.find_links.push({url: link})


            response.generic_list.push(listItem)
        })
    } catch (err) {
        console.log(err)
    }

    res.json(response);
})

app.get('/torino-channel', (req, res) => {
    let list = {},
        channel = {},
        base_url = req.protocol + '://' + req.get('host'),
        channel_base_url = base_url + req.route.path,
        url = config.tv_torino_url

    if (req.query.u) url += req.query.u;

    channel = {
        channel_name: 'Torino Channel',
        fanart: base_url + '/home_bg_stadio.jpg',
        thumbnail: base_url + '/logo_torino.png',
        menu: []
    }

    request(url, function (
        error,
        response,
        body
    ) {
        const $ = cheerio.load(body);

        if (!req.query.u && !req.query.f) {

            $('.main-menu a').each((_idx, el) => {
                let href = $(el).attr('href');

                if (href.match(/diretta\-live/)) {
                    channel.menu.unshift({
                        title: $(el).text().trim(),
                        videolibrary: false,
                        autoplay: true,
                        find_links: [
                            {
                                patterns: [
                                    "^(?:https?://).\\S+.m3u8$"
                                ],
                                url: config.tv_torino_url + href
                            }
                        ]
                    })
                } else {
                    channel.menu.push({
                        title: $(el).text().trim(),
                        link: channel_base_url + '/?u=' + href
                    })
                }

            });

            $('.fasce-container > .single-fascia').each((_idx, el) => {
                channel.menu.push({
                    title: $(el).find('h2:eq(0)').text(),
                    link: channel_base_url + '/?f=' + _idx
                })
            });
            response = channel;
        } else {
            list.generic_list = []

            $('.video-listing > .views-row').each((_idx, el) => {

                let image = $(el).find('.video-img picture > img').data('src');
                let videoUrl = $(el).find('.video-img a').attr('href');
                list.generic_list.push({
                    title: $(el).find('.vetrina-home-title > h2').text().trim(),
                    fanart: image ? config.tv_torino_url + image : undefined,
                    thumbnail: image ? config.tv_torino_url + image : undefined,
                    videolibrary: false,
                    autoplay: true,
                    find_links: [
                        {
                            patterns: [
                                "^(?:https?://).\\S+.m3u8$"
                            ],
                            url: videoUrl
                        }
                    ]
                })
            });

            if (req.query.f) {

                $('.video-fascia:eq(' + req.query.f + ')').find('.teaser-video-description').each((_idx, el) => {
                    let image = $(el).find('.teaser-video-img picture > img').data('src');
                    let videoUrl = $(el).find('.teaser-video-img a').attr('href');
                    list.generic_list.push({
                        title: $(el).find('.teaser-video-title > h2').text().trim(),
                        fanart: image ? config.tv_torino_url + image : undefined,
                        thumbnail: image ? config.tv_torino_url + image : undefined,
                        videolibrary: false,
                        autoplay: true,
                        find_links: [
                            {
                                patterns: [
                                    "^(?:https?://).\\S+.m3u8$"
                                ],
                                url: videoUrl
                            }
                        ]
                    })
                })
            }


            response = list;

        }

        res.json(response);
    })
})