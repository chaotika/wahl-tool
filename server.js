// config file
var fs   = require('fs')
var yaml = require('js-yaml')
var config = yaml.safeLoad(fs.readFileSync('config.yaml', 'utf8'))

// web server
var express = require('express')
var app = express()
var bodyParser = require('body-parser')
//app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
var server = require('http').Server(app)
server.listen(8080)
app.use(express.static('.'))

// database
var PouchDB = require('pouchdb')
var db = new PouchDB('db')

// other libraries
const cheerio = require('cheerio')
var jmespath = require('jmespath')
const { spawn } = require('child_process')

// index page
app.get('/', function (req, res) {
  const $ = cheerio.load('<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body></body></html>')
  $('head').append($('<title>'+config.title+'</title>'))
  $('head').append($('<link rel="stylesheet" href="/style.css">'))
  $('head').append($('<script src="/node_modules/jquery/dist/jquery.js"></script>'))
  $('body').append($('<h1>'+config.title+'</h1>'))
  $('body').append($('<form method="POST"><input name="id" autofocus></form>'))
  $('body').append($('<p><a href="/result">result</a></p>'))
  $('body').append($('<p><a href="/result/preftools">result by preftools</a></p>'))
  $('body').append($('<p><a href="/result/py3votecore">result by py3votecore</a></p>'))
  $('body').append($('<p><a href="/election-data.json">export election data</a></p>'))
  res.send($.html())
})

app.post('/', function (req, res) {
  res.redirect('/ballot/'+req.body.id)
})

// ballots
app.get('/ballot/:id', function (req, res) {
  const $ = cheerio.load('<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body></body></html>')

  $('head').append($('<title>'+config.title+'</title>'))
  $('head').append($('<link rel="stylesheet" href="/style.css">'))
  $('head').append($('<script src="/node_modules/jquery/dist/jquery.js"></script>'))

  $('body').append($('<h1>'+config.title+'</h1>'))
  $('body').append($('<h2>ballot '+req.params.id+'</h2>'))

  const ballot = $('<form id="ballot" class="ballot">')
  const ballot_content = $('<div class="ballot-content">')

  config.options.forEach((option,oi)=>{
    const row = $('<div id="option-'+oi+'" class="option"><div class="option-name">'+option+'</div></div>')
    Array.from(Array(config.options.length)).forEach((x,i) => {
      const optionbox = $('<div class="option-box">')
      const optionboxinput = $('<input class="option-box-input" id="option-box-'+oi+'-'+i+'" type="checkbox" name="option-box-'+oi+'-'+i+'">')
      optionbox.append(optionboxinput)
      row.append(optionbox)
    })
    ballot_content.append(row)
  })
  ballot.append(ballot_content)

  const validbox = $('<div class="ballot-valid"><input id="valid" class="valid" type="checkbox" name="valid" checked><label for="valid">valid</label></div>')
  ballot.append(validbox)

  $('body').append(ballot)
  //$('body').append($('<script>const config = '+JSON.stringify(config)+';</script>'))
  $('body').append($('<script src="/client.js"></script>'))

  db.get(req.params.id).then(function (ballot) {
    $('#ballot').append($('<input name="revision" type="hidden" value="'+ballot._rev+'">'))

    if ( !ballot.valid) {
      $('#valid').replaceWith($('<input id="valid" class="valid" type="checkbox" name="valid">'))
    }

    ballot.preference_boxes_checked.forEach((row,oi)=>{
      row.forEach((checked,i)=>{
        if (checked) {
          const optionboxinput = $('<input class="option-box-input" id="option-box-'+oi+'-'+i+'" type="checkbox" name="option-box-'+oi+'-'+i+'" checked>')
          $('#option-box-'+oi+'-'+i).replaceWith(optionboxinput)
        }
      })
    })
    res.send($.html())
  }).catch(function (err) {
    if ( err.reason == 'missing' )
      res.send($.html())
    else {
      console.log(err)
      res.status(500).send({
        'type': 'db error',
        'message': err
      })
    }
  })

})

app.post('/ballot/:id', function (req, res) {

  var ballot = {
    _id: req.params.id,
    type:"ballot",
    preference_boxes_checked:[],
    valid: true
  }

  if ( typeof req.body.revision == "string" )
    ballot._rev = req.body.revision

  if ( req.body.valid == "on" ) {
    ballot.valid = true
  } else {
    ballot.valid = false
  }

  Array.from(Array(config.options.length)).forEach(() => {
    var o = []
    Array.from(Array(config.options.length)).forEach(() => {
      o.push(false)
    })
    ballot.preference_boxes_checked.push(o)
  })

  Object.keys(req.body).forEach((key)=>{
    match = /option-box-(.*)-(.*)/.exec(key)
    if( match && req.body[key] == "on" )
      ballot.preference_boxes_checked[match[1]][match[2]] = true
  })

  if(ballot.valid) {
    ballot.preference_boxes_checked.forEach((row,oi)=>{
      row_sum = row.reduce((total, num) => {
        return total + num
      })
      if( row_sum > 1 )
        ballot.valid = false
    })
  }

  if(ballot.valid) {
    preference_indices = []
    ballot.preference_boxes_checked.forEach( (row,oi)=>{
      preference_index = config.options.length
      row.forEach((checked,i)=>{
        if(checked)
          preference_index = i
      })
      preference_indices.push(preference_index)

    })
    preferences = []

    Array.from(Array(config.options.length+1)).forEach( () => {
      var o = []
      preferences.push(o)
    })

    preference_indices.forEach( (preference_index,oi)=>{
      preferences[preference_index].push(config.options[oi])
    })
    ballot.preferences = preferences.filter( (el) => {
      return el.length > 0
    })

  }

  console.log(ballot)

  db.put(ballot).then(function(doc) {
    res.send(true)
  }).catch(function (err) {
    console.log(err)
    res.status(500).send({
      'type': 'db error',
      'message': err
    })
  })
})

app.get('/election-data.json', (req,res)=>{
  db.allDocs({
    include_docs: true
  }).then(function (result) {
    res.send({
      config: config,
      ballots: jmespath.search(result,"rows[].doc")
    })
  }).catch(function (err) {
    console.log(err)
    res.status(500).send({
      'type': 'db error',
      'message': err
    })
  })
})

app.get('/preftools/candidates.txt', (req,res)=>{
  res.set({ 'content-type': 'text/plain; charset=utf-8' })
  config.options.forEach((option)=>{
    res.write(option+"\n")
  })
  res.end()
})

app.get('/preftools/ballots.txt', (req,res)=>{
  res.set({ 'content-type': 'text/plain; charset=utf-8' })
  db.allDocs({
    include_docs: true
  }).then(function (result) {
    ballots = []
    jmespath.search(result,"rows[].doc").forEach((ballot)=>{
      line = ""
      if(ballot.type == 'ballot' && ballot.valid){
        ballot.preferences.forEach((rank)=>{
          rank.forEach((option)=>{
            line = line + option + " , "
          })
          line = line + " ; "
        })
        res.write(line+"\n")
      }
    })
    res.end()
  }).catch(function (err) {
    console.log(err)
    res.status(500).send({
      'type': 'db error',
      'message': err
    })
  })
})

app.get('/result/preftools', (req,res)=>{
  const preftools = spawn('sh', ['result-preftools.sh'])
  res.set({ 'content-type': 'text/plain; charset=utf-8' })
  preftools.stdout.on('data',(data)=>{
    res.write(data)
  })
  preftools.stderr.on('data',(data)=>{
    res.write(data)
  })
  preftools.on('close',(code)=>{
    res.end()
  })
})

app.get('/result/py3votecore', (req,res)=>{
  db.allDocs({
    include_docs: true
  }).then(function (result) {
    ballots = []
    jmespath.search(result,"rows[].doc").forEach((ballot)=>{
      if(ballot.type == 'ballot' && ballot.valid)
        ballots.push({
          ballot:ballot.preferences
        })
    })
    stdin = {
      config:config,
      ballots:ballots
    }
    const py3votecore = spawn('python3', ['result-py3votecore.py'])
    py3votecore.stdin.write(JSON.stringify(stdin))
    py3votecore.stdin.end()
    res.set({ 'content-type': 'text/plain; charset=utf-8' })
    py3votecore.stdout.on('data',(data)=>{
      res.write(data)
    })
    py3votecore.stderr.on('data',(data)=>{
      res.write(data)
    })
    py3votecore.on('close',(code)=>{
      res.end()
    })
  }).catch(function (err) {
    console.log(err)
    res.status(500).send({
      'type': 'db error',
      'message': err
    })
  })
})

// result
app.get('/result', function (req, res) {

  const $ = cheerio.load('<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body></body></html>')
  $('head').append($('<title>'+config.title+'</title>'))
  $('head').append($('<link rel="stylesheet" href="/style.css">'))
  $('head').append($('<script src="/node_modules/jquery/dist/jquery.js"></script>'))
  $('body').append($('<h1>'+config.title+'</h1>'))
  $('body').append($('<h2>result</h2>'))
  res.send($.html())

  // db.allDocs({
  //   include_docs: true
  // }).then(function (result) {
  //   result.rows.forEach((r)=>{
  //     var valid = true
  //     var options = []
  //     r.doc.options.forEach((option,oi)=>{
  //       n=false
  //       checked=true
  //       option.forEach((checked,i)=>{
  //         if(checked && n != 0 ) valid = false
  //         if(checked) n = i
  //       })
  //       options.push(n)
  //     })
  //     console.log(options)
  //   })
  //   res.send(result);
  // }).catch(function (err) {
  //   console.log(err);
  // });

})
