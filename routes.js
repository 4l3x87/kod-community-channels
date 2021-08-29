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
    let data = []
    try {
        req.body.forEach(item => {
            // console.log(item)
            if (item._ == 'message') {
                item.message = item.message.replace(/ \n/g, '\n')
                item.message = item.message.replace(/\n\n\nhttp/g, '\nhttp')
                item.message = item.message.replace(/\n\nhttp/g, '\nhttp')
                item.message.split("\n\n").forEach(message => {
                    if (message.match(/https?:\/\//)) {
                        // console.log(message)

                        const regex = new RegExp(/^(?<serie>.*)\s(?<season>[0-9]+)(?:X|×)(?<episode>[0-9]+)\s*(?:"(?<title>[^"]+)")?.*$/im);
                        const found = message.match(regex)
                        // console.log(found)
                        if (found) {
                            const links = message.matchAll(new RegExp(/^(https?:\/\/\S*)$/img))
                            if (links) {
                                let episode = {
                                    message_id: item.id,
                                    message_date: item.date,
                                    serie: found.groups['serie'],
                                    season: found.groups['season'],
                                    episode: found.groups['episode'],
                                    title: found.groups['title'] ? found.groups['title'] : null,
                                    links: []
                                }
                                for (const link of links) {
                                    episode.links.push(link[0])
                                }
                                data.push(episode)
                            }
                        } else {
                            // console.log(item)
                        }

                    }
                })
            }

        })

    } catch (e) {
        // console.log(e)
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
        data: data
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
                find_links: []
            }

            if (item.title) listItem.title += " \"" + item.title + "\""

            for (const link of item.links)
                listItem.find_links.push({url: link})


            response.generic_list.push(listItem)
        })
    }catch(err){
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
                        links: [
                            {
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