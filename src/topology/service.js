/*
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
*/

import * as d3 from "d3";
import {
  adjustPositions,
  genPath,
  getSaved,
  linkColor,
  circularize,
  initSankey,
  serviceColor,
  Sankey,
  setLinkStat,
  updateSankey,
  endall,
  VIEW_DURATION,
  ServiceWidth,
  ClusterPadding,
  ServiceHeight,
  setSaved,
} from "../utilities";
import { interpolatePath } from "d3-interpolate-path";
import { Node, Nodes } from "./nodes.js";
import { Links } from "./links.js";
const SERVICE_POSITION = "svc";
export class Service {
  constructor(adapter) {
    this.adapter = adapter;
    this.serviceNodes = new Nodes();
    this.serviceLinks = new Links();
    this.nodes = () => this.serviceNodes;
    this.links = () => this.serviceLinks;
    this.fields = [
      { title: "Address", field: "address" },
      { title: "Protocol", field: "protocol" },
      { title: "Deployed at", field: "deployedAt" },
    ];
  }

  createSelections(svg) {
    this.servicesSelection = this.createServicesSelection(svg);
    this.linksSelection = this.createLinksSelection(svg);
  }

  setupSelections(viewer) {
    this.servicesSelection = this.setupServicesSelection(viewer);
    this.linksSelection = this.setupLinksSelection(viewer);
  }

  initNodesAndLinks = (viewer) => {
    this.initNodes(viewer, false);
    const vsize = this.initLinks(viewer, {
      width: viewer.width,
      height: viewer.height,
    });
    return { nodeCount: this.serviceNodes.nodes.length, size: vsize };
  };

  initNodes(viewer, includeExtra) {
    const serviceNodes = this.serviceNodes;
    this.adapter.data.services.forEach((service) => {
      if (
        includeExtra ||
        !serviceNodes.nodes.some((n) => n.name === service.address)
      ) {
        const subNode = new Node({
          name: service.address,
          nodeType: "service",
          fixed: true,
          heightFn: this.serviceHeight,
          widthFn: this.serviceWidth,
        });
        subNode.mergeWith(service);
        subNode.lightColor = d3.rgb(serviceColor(subNode.name)).brighter(0.6);
        subNode.color = serviceColor(subNode.name);
        subNode.cluster = this.adapter.data.sites.find((site) =>
          site.services.includes(service)
        );
        subNode.shortName = this.adapter.shortName(subNode.name);
        if (includeExtra) {
          const original = serviceNodes.nodeFor(subNode.name);
          if (original) {
            subNode.extra = true;
            subNode.original = original;
          }
        }
        serviceNodes.add(subNode);
      }
    });
  }

  initLinks = (viewer, vsize) => {
    const serviceNodes = this.serviceNodes.nodes;
    // initialize the service to service links for the service view
    const links = this.serviceLinks;
    links.reset();

    // get the links between services for the service view
    serviceNodes.forEach((subNode, source) => {
      subNode.targetServices.forEach((targetService) => {
        const target = serviceNodes.findIndex(
          (sn) => sn.address === targetService.address
        );
        const linkIndex = links.getLink(
          subNode,
          serviceNodes[target],
          "out",
          "link",
          `Link-${source}-${target}`
        );
        const link = links.links[Math.abs(linkIndex)];
        link.request = this.adapter.linkRequest(
          subNode.address,
          serviceNodes[target]
        );
        link.value = link.request.bytes_out;
        link.getColor = () => linkColor(link, links.links);
      });
    });

    // get the service heights for use with the servicesankey view
    initSankey({
      nodes: serviceNodes,
      links: links.links,
      width: vsize.width,
      height: vsize.height,
      nodeWidth: ServiceWidth,
      nodePadding: ClusterPadding,
      left: 50,
      top: 20,
      right: 50,
      bottom: 10,
    });

    // set the expanded height
    serviceNodes.forEach((n) => {
      n.sankeyHeight = Math.max(n.y1 - n.y0, ServiceHeight);
    });

    // set the x,y based on links and expanded node sizes
    this.expandNodes();
    const newSize = adjustPositions({
      nodes: serviceNodes,
      links: links.links,
      width: vsize.width,
      height: vsize.height,
      align: "right",
      sort: true,
    });
    // move the sankey x,y
    serviceNodes.forEach((n) => {
      // override the default starting position with saved positions
      const key = `${SERVICE_POSITION}-${n.name}`;
      const pos = getSaved(key);
      if (pos) {
        n.x = pos.x;
        n.y = pos.y;
        n.x0 = pos.x0;
        n.y0 = pos.y0;
      } else {
        n.x0 = n.x;
        n.y0 = n.y;
      }
      // set sankey heights
      n.x1 = n.x0 + n.getWidth();
      n.y1 = n.y0 + n.getHeight(); // node is expanded
    });
    this.collapseNodes();

    // regen the link.paths
    Sankey().update({ nodes: serviceNodes, links: links.links });
    return newSize;
  };

  createServicesSelection = (svg) =>
    svg
      .append("svg:g")
      .attr("class", "services")
      .selectAll("g.service-type");

  createLinksSelection = (svg) =>
    svg
      .append("svg:g")
      .attr("class", "links")
      .selectAll("g");

  setupServicesSelection = (viewer) => {
    const selection = this.servicesSelection.data(
      this.serviceNodes.nodes,
      (d) => d.address
    );

    selection.exit().remove();
    const serviceTypesEnter = selection
      .enter()
      .append("svg:g")
      .attr("class", "service-type")
      .classed("extra", (d) => d.extra)
      .attr("transform", (d) => {
        return `translate(${d.x},${d.y})`;
      });

    serviceTypesEnter.append("svg:title").text((d) => d.name);

    serviceTypesEnter
      .append("svg:rect")
      .attr("class", "service-type")
      .attr("rx", 5)
      .attr("ry", 5)
      .attr("width", (d) => Math.max(ServiceWidth, d.getWidth()))
      .attr("height", (d) => d.getHeight())
      .attr("fill", "#FFFFFF");

    serviceTypesEnter
      .append("svg:text")
      .attr("class", "service-type")
      .attr("x", (d) => Math.max(ServiceWidth, d.getWidth()) / 2)
      .attr("y", (d) => d.getHeight() / 2)
      .attr("dominant-baseline", "middle")
      .attr("text-anchor", "middle")
      .text((d) => d.shortName);

    const links = this.serviceLinks.links;
    // draw circle on right if this serviceType
    // is a source of a link
    serviceTypesEnter
      .filter((d) => {
        return links.some((l) => l.source.name === d.name);
      })
      .append("svg:circle")
      .attr("class", "end-point source")
      .attr("r", 6)
      .attr("cx", (d) => Math.max(ServiceWidth, d.getWidth()))
      .attr("cy", 20);

    // draw diamond on left if this serviceType
    // is a target of a link
    serviceTypesEnter
      .filter((d) => {
        return links.some((l) => l.target.name === d.name);
      })
      .append("svg:rect")
      .attr("class", "end-point source")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", 10)
      .attr("height", 10)
      .attr("transform", "translate(0,13) rotate(45)");

    serviceTypesEnter
      .on("mousedown", (d) => {
        if (this.view === "servicesankey") {
          d3.event.stopPropagation();
          d3.event.preventDefault();
        }
      })
      .on("mouseover", function(d) {
        // highlight this service-type and it's connected service-types
        d.selected = true;
        viewer.highlightServiceType(true, d3.select(this), d, viewer);
        viewer.opaqueServiceType(d);
        viewer.restart();
        d3.event.stopPropagation();
      })
      .on("mouseout", function(d) {
        d.selected = false;
        viewer.highlightServiceType(false, d3.select(this), d, viewer);
        viewer.restart();
        d3.event.stopPropagation();
      })
      .on("click", function(d) {
        if (d3.event.defaultPrevented) return; // click suppressed
        viewer.showChord(d);
        viewer.showCard(d);
        d3.event.stopPropagation();
        d3.event.preventDefault();
      });

    selection.classed("selected", (d) => d.selected);

    // adjust service name text based on its size
    selection.select("text.service-type").text(function(d) {
      if (!d.ellipseName) {
        d.ellipseName = d.shortName;
        let { width } = this.getBBox();
        let first = d.shortName.length - 4;
        while (width > d.getWidth() - 20) {
          --first;
          d.ellipseName = `${d.shortName.substr(
            0,
            first
          )}...${d.shortName.slice(-4)}`;
          this.innerHTML = d.ellipseName;
          width = this.getBBox().width;
        }
      }
      return d.ellipseName;
    });

    return selection;
  };

  setupLinksSelection = (viewer) => {
    // serviceLinksSelection is a selection of all g elements under the g.links svg:group
    // here we associate the links.links array with the {g.links g} selection
    // based on the link.uid
    const links = this.serviceLinks.links;
    const selection = this.linksSelection.data(links, (d) => d.uid);
    // remove old links
    selection.exit().remove();

    // add new links. if a link with a new uid is found in the data, add a new path
    let enterpath = selection.enter().append("g");

    // the d attribute of the following path elements is set in tick()
    enterpath.append("path").attr("class", "service");

    enterpath
      .append("path")
      .attr("class", "servicesankeyDir")
      .classed("tcp", (d) => d.target.protocol === "tcp")
      .attr("stroke-width", 2)
      .attr("id", (d) => `dir-${d.source.name}-${d.target.name}`)
      // reset the markers based on current highlighted/selected
      .attr(
        "marker-end",
        (d) => `url(#${d.target.protocol === "tcp" ? "tcp-end" : "end--15"})`
      );

    enterpath
      .append("path")
      .attr("class", "hittarget")
      .attr("id", (d) => `hitpath-${d.source.uid()}-${d.target.uid()}`)
      .on("mouseover", function(d) {
        // mouse over a path
        //d.selected = true;
        viewer.highlightConnection(true, d3.select(this), d, viewer);
        viewer.popupCancelled = false;
        viewer.showLinkInfo(d);
        //viewer.restart();
      })
      .on("mouseout", function(d) {
        //d.selected = false;
        viewer.handleMouseOutPath(d);
        viewer.highlightConnection(false, d3.select(this), d, viewer);
        viewer.clearPopups();
        //viewer.restart();
      })
      // left click a path
      .on("click", (d) => {
        d3.event.stopPropagation();
        viewer.clearPopups();
        viewer.showLinkInfo(d);
      });

    enterpath
      .append("text")
      .attr("font-size", "12px")
      .attr("font-weight", "bold")
      .append("textPath")
      .attr("class", "stats")
      .attr("text-anchor", "middle")
      .attr("startOffset", "50%")
      .attr("text-length", "100%")
      .attr("href", (d) => `#statPath-${d.source.name}-${d.target.name}`);

    // update each existing {g.links g.link} element
    selection
      .select(".service")
      .classed("selected", function(d) {
        return d.selected;
      })
      .classed("highlighted", function(d) {
        return d.highlighted;
      });

    selection.select(".hittarget").classed("selected", (d) => d.selected);
    viewer.setLinkStat();
    return selection;
  };

  selectionSetBlack = () => {
    d3.selectAll("path.service").classed("forceBlack", (d) => d.black);
  };
  serviceHeight = (n, expanded) => {
    if (expanded === undefined) {
      expanded = n.expanded;
    }
    if (expanded && n.sankeyHeight) {
      return Math.max(n.sankeyHeight, ServiceHeight);
    }
    return ServiceHeight;
  };

  serviceWidth = (node, expanded) => {
    return ServiceWidth;
  };

  savePosition = (d) => {
    setSaved(`${SERVICE_POSITION}-${d.name}`, {
      x: d.x,
      y: d.y,
      x0: d.x0,
      y0: d.y0,
    });
  };
  dragStart = (d) => {
    d.x = d.x0;
    d.y = d.y0;
    this.savePosition(d);
  };

  drag = (d) => {
    d.x = d.x0 = d.px;
    d.y = d.y0 = d.py;
    this.savePosition(d);
  };

  tick() {
    this.servicesSelection.attr("transform", (d) => {
      d.x0 = d.x;
      d.y0 = d.y;
      d.x1 = d.x0 + d.getWidth();
      d.y1 = d.y0 + d.getHeight();
      return `translate(${d.x},${d.y})`;
    });
    updateSankey({
      nodes: this.serviceNodes.nodes,
      links: this.serviceLinks.links,
    });
  }

  drawViewPath(sankey) {
    circularize(this.serviceLinks.links);
    this.linksSelection.selectAll("path.service").attr("d", (d) => {
      if (sankey) {
        return genPath({ link: d, useSankeyY: true, sankey: true });
      } else {
        return null;
      }
    });
    this.linksSelection.selectAll("path.hittarget").attr("d", (d) => {
      if (sankey) {
        return genPath({ link: d, useSankeyY: true });
      } else {
        return genPath({ link: d });
      }
    });
    this.linksSelection.selectAll("path.servicesankeyDir").attr("d", (d) => {
      if (sankey) {
        return genPath({ link: d, useSankeyY: true });
      } else {
        return genPath({ link: d });
      }
    });
  }

  collapseNodes() {
    this.serviceNodes.nodes.forEach((n) => {
      n.expanded = false;
    });
  }
  expandNodes() {
    this.serviceNodes.nodes.forEach((n) => {
      n.expanded = true;
    });
  }

  setBlack = (black) => {
    this.serviceLinks.links.forEach((l) => (l.black = black));
  };

  setLinkStat = (sankey, props) => {
    setLinkStat(
      this.linksSelection,
      "servicesankeyDir",
      props.options.link.stat,
      props.getShowStat()
    );
  };

  setupDrag(drag) {
    this.servicesSelection.call(drag);
  }
  highlightLink(highlight, link, d, sankey, color) {
    this.linksSelection
      .selectAll("path.service")
      .filter((d1) => d1 === d)
      .attr("opacity", highlight ? (sankey ? 0.8 : 0) : sankey ? 0.5 : 0);

    this.linksSelection
      .selectAll("path.servicesankeyDir")
      .filter((d1) => d1 === d)
      .attr("opacity", 1);

    // highlight/blur the services on each end of the link
    this.servicesSelection
      .filter(
        (d1) =>
          d1.address === d.source.address || d1.address === d.target.address
      )
      .attr("opacity", 1);
  }
  blurAll(blur, d, sankey, color) {
    const opacity = blur ? 0.25 : 1;
    this.servicesSelection.attr("opacity", opacity);
    this.linksSelection
      .selectAll("path.service")
      .attr("opacity", blur ? (color ? 0 : 0.25) : sankey ? 0.5 : 0);
    this.linksSelection
      .selectAll("path.servicesankeyDir")
      .attr("opacity", blur ? 0.25 : 1);
  }

  transition(sankey, initial, color, viewer) {
    if (sankey) {
      return this.toServiceSankey(initial, viewer.setLinkStat);
    } else {
      return this.toService(initial, viewer.setLinkStat, color);
    }
  }

  toService = (initial, setLinkStat, color) => {
    return new Promise((resolve) => {
      // Note: all the transitions happen concurrently
      d3.selectAll("g.service-type")
        .attr("transform", (d) => `translate(${d.x},${d.y})`)
        .attr("opacity", 1);

      d3.selectAll("path.servicesankeyDir")
        .transition()
        .duration(VIEW_DURATION)
        .attr("stroke", (d) => (color ? d.getColor() : "black")) //d.target.color))
        .attr("stroke-width", 2)
        .attrTween("d", function(d, i) {
          const previous = d3.select(this).attr("d");
          const current = genPath({ link: d });
          return interpolatePath(previous, current);
        });

      d3.selectAll(".end-point")
        .transition()
        .duration(VIEW_DURATION)
        .attr("opacity", 1)
        .call(endall, () => {
          resolve();
        });

      // shrink the hittarget paths
      d3.selectAll("path.hittarget")
        .attr("d", (d) => genPath({ link: d }))
        .attr("stroke-width", 6)
        .attr("stroke", (d) => (color ? d.getColor() : null))
        .attr("opacity", color ? 0.25 : null);

      // collapse the rects (getWidth() and getHeight() will return non-expanded sizes)
      d3.selectAll("rect.service-type")
        .transition()
        .duration(VIEW_DURATION)
        .attr("fill", (d) => d.lightColor)
        .attr("width", (d) => d.getWidth())
        .attr("height", (d) => d.getHeight())
        .attr("opacity", 1);

      // move the address text to the middle
      d3.selectAll("text.service-type")
        .transition()
        .duration(VIEW_DURATION)
        .attr("y", (d) => d.getHeight() / 2)
        .attr("opacity", 1);

      // change the path's width and location
      d3.selectAll("path.service")
        .transition()
        .duration(VIEW_DURATION)
        .attr("stroke", (d) => (color ? d.getColor() : null))
        .attr("stroke-width", 0)
        .attr("opacity", 0)
        .attrTween("d", function(d) {
          const previous = d3.select(this).attr("d");
          const current = genPath({ link: d, sankey: true, width: 2 });
          const ip = interpolatePath(previous, current);
          return (t) => {
            setLinkStat();
            return ip(t);
          };
        });
    });
  };

  toServiceSankey = (initial, setLinkStat) => {
    return new Promise((resolve) => {
      d3.selectAll(".end-point")
        .transition()
        .duration(VIEW_DURATION)
        .attr("opacity", 0);

      // move the service rects to their sankey locations
      d3.selectAll("g.service-type")
        .transition()
        .duration(VIEW_DURATION)
        .attr("transform", (d) => `translate(${d.x0},${d.y0})`)
        .call(endall, () => {
          resolve();
        });

      // expand services to traffic height
      d3.selectAll("rect.service-type")
        .transition()
        .duration(VIEW_DURATION)
        .attr("height", (d) => d.getHeight())
        .attr("fill", (d) => d.lightColor)
        .attr("opacity", 1);

      // put service names in middle of rect
      d3.selectAll("text.service-type")
        .transition()
        .duration(VIEW_DURATION)
        .attr("y", (d) => d.getHeight() / 2)
        .attr("opacity", 1);

      // expand the hittarget paths
      d3.selectAll("path.hittarget")
        .attr("d", (d) => genPath({ link: d, useSankeyY: true }))
        .attr("stroke-width", (d) => Math.max(6, d.width))
        .attr("stroke", "transparent")
        .attr("opacity", null);

      // draw the sankey path
      d3.selectAll("path.service")
        .transition()
        .duration(VIEW_DURATION)
        .attr("stroke", (d) => d.target.color)
        .attr("fill", (d) => d.target.color)
        .attr("stroke-width", 0)
        .attr("opacity", 0.5)
        .attrTween("d", function(d, i) {
          const previous = genPath({
            link: d,
            useSankeyY: true,
            sankey: true,
            width: 2,
          });
          const current = genPath({ link: d, useSankeyY: true, sankey: true }); //d.sankeyPath;
          const ip = interpolatePath(previous, current);
          return (t) => {
            setLinkStat();
            return ip(t);
          };
        });

      // show the serviceTraffic arrows in the links
      d3.selectAll("path.servicesankeyDir")
        .transition()
        .duration(VIEW_DURATION)
        .attr("stroke-width", 1)
        .attr("stroke", "black")
        .attrTween("d", function(d, i) {
          const previous = d3.select(this).attr("d");
          const current = genPath({ link: d, useSankeyY: true });
          return interpolatePath(previous, current);
        });
    });
  };

  doFetch = (page, perPage) => {
    const data = this.serviceNodes.nodes.map((n) => ({
      address: n.address,
      protocol: n.protocol,
      deployedAt: n.cluster ? n.cluster.site_name : "",
    }));
    return new Promise((resolve) => {
      resolve({ data, page, perPage });
    });
  };

  chordOver(chord, over, viewer) {
    d3.selectAll("path.service").each(function(p) {
      if (
        `-${p.source.name}-${p.target.name}` === chord.key ||
        `-${p.target.name}-${p.source.name}` === chord.key
      ) {
        p.selected = over;
        viewer.blurAll(over, p);
        viewer.restart();
      }
    });
  }

  arcOver(arc, over, viewer) {
    d3.selectAll("rect.service-type").each(function(d) {
      if (arc.key === d.address) {
        d.selected = over;
        viewer.blurAll(over, d);
        viewer.opaqueServiceType(d);
        viewer.restart();
      }
    });
  }
}
