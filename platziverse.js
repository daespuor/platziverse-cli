#!/usr/bin/env node

'use strict'
const blessed = require('blessed')
const contrib = require('blessed-contrib')
const PlatziverseAgent = require('platziverse-agent')
const agent = new PlatziverseAgent()
const moment= require('moment')
const screen = blessed.screen()
const agents = new Map()
const agentMetrics = new Map()
let extended= []
let selected={
  uuid:null,
  type:null
}
const limit=10

/* eslint new-cap: 0 */
const grid = new contrib.grid({
  rows: 1,
  cols: 4,
  screen
})

const tree = grid.set(0, 0, 1, 1, contrib.tree, {
  label: 'Connected Agents'
})

const line = grid.set(0, 1, 1, 3, contrib.line, {
  label: 'Metrics',
  showLegend: true,
  minY: 0,
  xPadding: 5,
  style:{
    line: "red"
  }
})

screen.key(['espace', 'q', 'C-c'], (ch, key) => {
  process.exit(0)
})

agent.connect()

agent.on('agent/connected', (payload) => {
  let {uuid} = payload.agent
  if (!agents.has(uuid)) {
    agents.set(uuid, payload.agent)
    agentMetrics.set(uuid, {})
  }

  renderData()
})

agent.on('agent/disconnected',(payload)=>{
    let {uuid}= payload.agent
    if(agents.has(uuid)){
        agents.delete(uuid)
        agentMetrics.delete(uuid)
    }

    renderData()
})

agent.on('agent/message',(payload)=>{
    let {uuid}= payload.agent
    let {timestamp}=payload
    if(!agents.has(uuid)){
      agents.set(uuid,payload.agent)
      agentMetrics.set(uuid,{})
    }
    let metrics= agentMetrics.get(uuid)

    payload.metrics.forEach(m=>{
      let type= m.type.value
      let {value}=m
      if(!Array.isArray(metrics[type])){
        metrics[type]=[]
      }

      if(metrics[type].length>=limit){
        metrics[type].shift()
      }

      metrics[type].push({
        value,
        timestamp: moment(timestamp).format('HH:mm:ss')
      })

    })

    renderData()
})

tree.on('select',(node)=>{
  let {uuid} = node
  if(node.agent){
    node.extended ? extended.push(uuid):extended=extended.filter(a=>a!==uuid)
    selected.uuid=null
    selected.type=null
    return
  }
  selected.uuid=node.uuid
  selected.type=node.type

  renderMetrics()
})

function renderMetrics(){
  
  if(!selected.uuid && !selected.type){
    const data=[{x:[],y:[],title:''}]
    line.setData(data)
    screen.render()
    return
  }
    const metrics= agentMetrics.get(selected.uuid)
    const values= metrics[selected.type]
    const data=[
      {
        title:selected.type,
        x:values.map(v=> v.timestamp),
        y:values.map(v=>v.value)
      }
    ]

    line.setData(data)
    screen.render()
}
function renderData () {
  let treeData = []

  for (let [uuid, val] of agents) {
    let aMetrics=[]
    let key = `${val.name} - ${val.pid}`
    treeData[key] = {
      uuid,
      agent: true,
      extended:extended.includes(uuid),
      children: {}
    }

    let metrics= agentMetrics.get(uuid)
    Object.keys(metrics).forEach(type=>{
      let mTitle=`${type}-${uuid}`
      let metric={
        uuid,
        type,
        metric:true
      }
      treeData[key].children[mTitle]=metric
    })
   
  
  }

  tree.setData({
    extended:true,  
    children:treeData
})

  renderMetrics()
}

tree.focus()
screen.render()
