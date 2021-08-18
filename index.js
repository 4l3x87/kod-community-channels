const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000
const request = require('request')
const cheerio = require('cheerio')

const request_base_url = 'https://tv.torinofc.it';
const app = express()
    .use(express.static(path.join(__dirname, 'public')))
    .set('views', path.join(__dirname, 'views'))
    .set('view engine', 'ejs')

app.listen(PORT, () => console.log(`Listening on ${PORT}`))

app.get('/', (req, res) => {
    let base_url = req.protocol + '://' + req.get('host');
    res.json({
        name: 'KOD Community Channels by 4l3x87',
        channels: [
            {
                title: 'Torino Channel',
                link: base_url + '/torino-channel'
            }
        ]
    })
})

app.get('/torino-channel', (req, res) => {
    let list = {},
        channel = {},
        base_url = req.protocol + '://' + req.get('host'),
        channel_base_url = base_url + req.route.path,
        url = request_base_url

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
                        links: [
                            {
                                url: request_base_url + href
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
                    fanart: image ? request_base_url + image : undefined,
                    thumbnail: image ? request_base_url + image : undefined,
                    videolibrary: false,
                    autoplay: true,
                    patterns: [
                        "^(?:https?:\\/\\/).\\S+.m3u8$"
                    ],
                    links: [
                        {
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
                        fanart: image ? request_base_url + image : undefined,
                        thumbnail: image ? request_base_url + image : undefined,
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