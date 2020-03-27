import * as d3 from "d3";
import { interpolatePath } from "d3-interpolate-path";
import { ServiceStart, ServiceGap } from "./graph";
import { genPath } from "../utilities";

const VIEW_DURATION = 1000;
const EXPAND_DURATION = 500;

class Transitions {
  toSite = initial => {
    return new Promise(resolve => {
      if (!initial) {
        d3.selectAll("path.siteTrafficLink")
          .transition()
          .duration(VIEW_DURATION)
          .attr("stroke-width", 2)
          .attr("opacity", 0)
          .call(endall, () => {
            d3.select("g.siteTrafficLinks").style("display", "none");
            resolve();
          });

        d3.selectAll("path.siteTrafficDir")
          .transition()
          .duration(VIEW_DURATION)
          .attr("opacity", 0);

        d3.select("g.siteLinks")
          .transition()
          .duration(VIEW_DURATION)
          .attr("opacity", 1);

        d3.select("g.siteTrafficLinks")
          .selectAll("text.stats")
          .transition()
          .duration(VIEW_DURATION)
          .attr("opacity", 0);
      } else {
        d3.selectAll("g.siteTrafficLinks").style("display", "none");
      }

      // transition the containers to their proper position
      d3.selectAll(".cluster")
        .transition()
        .duration(VIEW_DURATION)
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .each("end", function() {
          d3.select(this)
            .style("display", "block")
            .attr("opacity", 1)
            .select(".cluster-rects")
            .attr("opacity", 1)
            .style("display", "block");
        });

      // change the path's width and location
      d3.selectAll("path.site")
        .attr("opacity", 1)
        .attr("stroke-width", null);

      d3.selectAll("path.mask")
        .transition()
        .duration(VIEW_DURATION)
        .attr("stroke-width", 1)
        .attr("stroke", d => d.link.target.color)
        .attr("opacity", 0)
        .attrTween("d", function(d, i) {
          const previous = d3.select(this).attr("d");
          const current = genPath(d.link, undefined, d.mask);
          return interpolatePath(previous, current);
        });

      d3.selectAll("rect.network")
        .transition()
        .duration(VIEW_DURATION)
        .attr("width", d => d.getWidth())
        .attr("height", d => d.getHeight());

      d3.selectAll("text.cluster-name").attr("y", d => d.getHeight() / 2);

      // hide services
      d3.selectAll("g.services").style("display", "none");
    });
  };

  toDeployment = initial => {
    return new Promise((resolve, reject) => {
      this.hideServiceLinks();
      this.hideSiteLinks();
      this.hideSankeySiteLinkDir();
      this.hideSankeyServiceLinkDir();
      this.hideSiteServiceSankeyLinks();
      this.hideSiteServiceSankeyLinkDir();
      this.hideEndpoints();

      d3.select("g.clusters")
        .style("display", "block")
        .transition()
        .duration(VIEW_DURATION)
        .attr("opacity", 1);

      // transition the containers to their proper position
      d3.selectAll(".cluster")
        .transition()
        .duration(VIEW_DURATION)
        .attr("transform", d => `translate(${d.x0},${d.y0})`)
        .each("end", function() {
          d3.select(this)
            .style("display", "block")
            .attr("opacity", 1)
            .select(".cluster-rects")
            .attr("opacity", 1)
            .style("display", "block");
        });

      d3.select("g.clusters")
        .selectAll("circle.network")
        .transition()
        .duration(VIEW_DURATION)
        .attr("r", d => d.r)
        .attr("cx", d => d.r)
        .attr("cy", d => d.r);

      d3.select("g.clusters")
        .selectAll("text.cluster-name")
        .transition()
        .duration(initial ? 0 : VIEW_DURATION)
        .attr("y", -10)
        .attr("x", d => d.getWidth() / 2);

      // move the service rects to their proper position within the container

      d3.selectAll("g.service-type")
        .transition()
        .duration(VIEW_DURATION)
        .attr("transform", d => {
          return `translate(${d.x0},${d.y0})`;
        });

      d3.selectAll("rect.service-type")
        .transition()
        .duration(VIEW_DURATION)
        .attr("width", d => d.getWidth())
        .attr("height", d => d.getHeight())
        .attr("fill", d => d.lightColor)
        .attr("opacity", 1);

      d3.selectAll("text.service-type")
        .transition()
        .duration(VIEW_DURATION)
        .attr("opacity", 1)
        .attr("y", d => d.getHeight() / 2)
        .call(endall, () => {
          resolve();
        });

      // change the path's width and location
      d3.selectAll("path.deployment")
        .attr("d", d => genPath(d))
        .attr("opacity", 1)
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", function(d) {
          d.pathLen = this.getTotalLength();
          return `${d.pathLen} ${d.pathLen}`;
        })
        .attr("stroke-dashoffset", d => d.pathLen)
        .transition()
        .duration(VIEW_DURATION / 2)
        .attr("stroke-dashoffset", 0)
        .each("end", function(d) {
          d3.select(this).attr("stroke-dasharray", null);
        });

      d3.select("g.deploymentLinks")
        .selectAll("path.hittarget")
        .attr("d", d => genPath(d))
        .attr("stroke-width", 20);
    });
  };

  toService = (initial, setLinkStat) => {
    return new Promise((resolve, reject) => {
      // Note: all the transitions happen concurrently

      if (initial) {
        d3.selectAll("g.service-type")
          .attr("transform", d => {
            return `translate(${d.x},${d.y})`;
          })
          .attr("opacity", 1);
      }

      this.hideSankeyServiceLinkDir();
      this.showServiceLinks();
      this.showEndpoints();

      // shrink the hittarget paths
      d3.selectAll("path.hittarget")
        .attr("d", d => d.path)
        .attr("stroke-width", 20);

      // show the services
      d3.selectAll("g.services").style("display", "block");

      // put the service-type groups in their proper location
      d3.selectAll("g.service-type")
        .transition()
        .duration(VIEW_DURATION)
        .attr("transform", d => `translate(${d.x0},${d.y0})`)
        .attr("opacity", 1)
        .call(endall, () => {
          resolve();
        });

      // collapse the rects (getWidth() and getHeight() will return non-expanded sizes)
      d3.selectAll("rect.service-type")
        .transition()
        .duration(VIEW_DURATION)
        .attr("fill", d => d.lightColor)
        .attr("width", d => d.getWidth())
        .attr("height", d => d.getHeight())
        .attr("opacity", 1);

      // move the address text to the middle
      d3.selectAll("text.service-type")
        .transition()
        .duration(VIEW_DURATION)
        .attr("y", d => d.getHeight() / 2)
        .attr("opacity", 1);

      d3.selectAll("path.mask")
        .transition()
        .duration(VIEW_DURATION)
        .attr("stroke-width", 1)
        .attr("stroke", d => d.link.target.color)
        .attr("opacity", 0)
        .attrTween("d", function(d, i) {
          const previous = d3.select(this).attr("d");
          const current = genPath(d.link, undefined, d.mask);
          return interpolatePath(previous, current);
        });

      // change the path's width and location
      if (initial) {
        d3.selectAll("path.service")
          .attr("opacity", 1)
          .attr("d", d => d.path)
          .attr("stroke-dasharray", function(d) {
            d.pathLen = this.getTotalLength();
            return `${d.pathLen} ${d.pathLen}`;
          })
          .attr("stroke-dashoffset", d => d.pathLen)
          .transition()
          .duration(VIEW_DURATION / 2)
          .attr("stroke-dashoffset", 0)
          .each("end", function(d) {
            d3.select(this).attr("stroke-dasharray", null);
          });
      } else {
        d3.selectAll("path.service")
          .transition()
          .duration(VIEW_DURATION)
          .attr("stroke", "black")
          .attr("stroke-width", 2)
          .attr("opacity", 1)
          .attrTween("d", function(d, i) {
            const previous = d.sankeyPath;
            const current = genPath(d); // d.path; //
            const ip = interpolatePath(previous, current);
            return t => {
              setLinkStat();
              return ip(t);
            };
          });
      }
    });
  };

  toServiceSankey = setLinkStat => {
    return new Promise(resolve => {
      this.hideEndpoints();

      // move the service rects to their traffic locations
      d3.selectAll("g.service-type")
        .filter(d => !d.extra)
        .transition()
        .duration(VIEW_DURATION)
        .attr("transform", d => `translate(${d.x0},${d.y0})`)
        .call(endall, () => {
          resolve();
        });

      // expand services to traffic height
      d3.selectAll("rect.service-type")
        .transition()
        .duration(VIEW_DURATION)
        .attr("height", d => d.getHeight())
        .attr("fill", d => d.lightColor)
        .attr("opacity", 1);

      // put service names in middle of rect
      d3.selectAll("text.service-type")
        .transition()
        .duration(VIEW_DURATION)
        .attr("y", d => d.getHeight() / 2)
        .attr("opacity", 1);

      // expand the hittarget paths
      d3.selectAll("path.hittarget")
        .attr("d", d => d.sankeyPath)
        .attr("stroke-width", d => Math.max(6, d.width));

      // change the path's width
      d3.selectAll("path.service")
        .attr("stroke", d => d.target.color)
        .transition()
        .duration(VIEW_DURATION)
        .attr("stroke-width", d => Math.max(6, d.width))
        .attr("opacity", 0.5)
        .attrTween("d", function(d, i) {
          const previous = d3.select(this).attr("d");
          const current = genPath(d); //d.sankeyPath; //genPath(d, "service");
          const ip = interpolatePath(previous, current);
          return t => {
            setLinkStat();
            return ip(t);
          };
        });
      d3.selectAll("path.mask")
        .attr("stroke-width", 2)
        .attr("opacity", 0)
        .transition()
        .duration(VIEW_DURATION)
        .attr("stroke-width", d => Math.max(6, d.link.width))
        .attr("stroke", d => d.link.target.color)
        .attr("opacity", 0.5)
        .attrTween("d", function(d, i) {
          const previous = d3.select(this).attr("d");
          const current = genPath(d.link, undefined, d.mask);
          return interpolatePath(previous, current);
        });

      // show the serviceTraffic arrows in the links
      d3.selectAll("path.servicesankeyDir")
        .style("display", "block")
        .attr("opacity", 0)
        .transition()
        .duration(VIEW_DURATION)
        .attr("stroke-width", 1)
        .attr("opacity", 1)
        .attrTween("d", function(d, i) {
          const previous = d3.select(this).attr("d");
          const current = d.sankeyPath;
          return interpolatePath(previous, current);
        });
    });
  };

  toDeploymentSankey = setLinkStat => {
    return new Promise((resolve, reject) => {
      this.hideEndpoints();
      d3.select("g.clusters")
        .selectAll("circle.network")
        .transition()
        .duration(VIEW_DURATION)
        .attr("r", d => d.sankey.r)
        .attr("cx", d => d.sankey.r)
        .attr("cy", d => d.sankey.r);

      d3.select("g.clusters")
        .selectAll("g.cluster")
        .transition()
        .duration(VIEW_DURATION)
        .attr("transform", d => `translate(${d.x},${d.sankey.y})`);

      d3.select("g.clusters")
        .selectAll("text.cluster-name")
        .transition()
        .duration(VIEW_DURATION)
        .attr("y", -10)
        .attr("x", d => d.getWidth(true) / 2);

      d3.selectAll("path.deployment")
        .style("display", "block")
        .transition()
        .duration(VIEW_DURATION)
        .attr("opacity", 0.5)
        .attr("stroke-width", d => d.width)
        .attrTween("d", function(d, i) {
          const previous = d3.select(this).attr("d");
          const current = d.sankeyPath; //d.path;
          return interpolatePath(previous, current);
        });

      d3.selectAll("path.deploymentDir")
        .style("display", "block")
        .transition()
        .duration(VIEW_DURATION)
        .attr("opacity", 1)
        .attr("stroke-width", 1)
        .attrTween("d", function(d, i) {
          const previous = d3.select(this).attr("d");
          const current = d.sankeyPath;
          return interpolatePath(previous, current);
        });

      // move the service rects to their sankey location
      d3.selectAll("g.service-type")
        .transition()
        .duration(VIEW_DURATION)
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

      d3.selectAll("rect.service-type")
        .transition()
        .duration(VIEW_DURATION)
        .attr("width", d => d.getWidth())
        .attr("height", d => d.getHeight())
        .attr("fill", d => d.lightColor)
        .attr("opacity", 1);

      d3.selectAll("text.service-type")
        .transition()
        .duration(VIEW_DURATION)
        .attr("opacity", 1)
        .attr("y", d => d.getHeight() / 2)
        .call(endall, () => {
          resolve();
        });
    });
  };

  toSiteSankey = () => {
    d3.select("g.siteTrafficLinks").style("display", "block");
    d3.select("g.siteLinks")
      .transition()
      .duration(VIEW_DURATION)
      .attr("opacity", 0.25);
    d3.selectAll("path.siteTrafficDir")
      .transition()
      .duration(VIEW_DURATION)
      .attr("opacity", 1);
    d3.select("g.siteTrafficLinks")
      .selectAll("text.stats")
      .transition()
      .duration(VIEW_DURATION)
      .attr("opacity", 1);

    d3.selectAll("path.siteTrafficLink")
      .attr("stroke-width", 2)
      .transition()
      .duration(VIEW_DURATION)
      .attr("opacity", 0.5)
      .attr("stroke-width", d => Math.max(6, d.width))
      .attr("stroke", d => d.target.color)
      .attrTween("d", function(d, i) {
        const previous = d3.select(this).attr("d");
        const current = previous; //d.path;
        return interpolatePath(previous, current);
      });
    d3.select("g.siteTrafficLinks")
      .selectAll("path.hittarget")
      .attr("stroke-width", d => Math.max(6, d.width));

    d3.selectAll("path.mask")
      .attr("stroke-width", 2)
      .attr("opacity", 0)
      .transition()
      .duration(VIEW_DURATION)
      .attr("stroke-width", d => Math.max(6, d.link.width))
      .attr("stroke", d => d.link.target.color)
      .attr("opacity", 0.5)
      .attrTween("d", function(d, i) {
        const previous = d3.select(this).attr("d");
        const current = genPath(d.link, undefined, d.mask);
        return interpolatePath(previous, current);
      });

    // hide services
    d3.selectAll("g.services").style("display", "none");
  };

  fromTraffic = (path, view) => {
    // contract services to smaller height
    d3.selectAll("rect.service-type")
      .transition()
      .duration(VIEW_DURATION)
      .attr("height", d => d.getHeight())
      .attr("fill", "#FFFFFF");

    // put service names in middle of rect
    d3.selectAll("text.service-type")
      .transition()
      .duration(VIEW_DURATION)
      .attr("y", d => d.getHeight() / 2);

    // change the path's width and location
    path
      .selectAll("path.service")
      .transition()
      .duration(VIEW_DURATION)
      .attr("stroke-width", null)
      .attr("opacity", 1)
      .attrTween("d", function(d) {
        const previous = d3.select(this).attr("d");
        const { sx, sy, tx, ty, sxoff, syoff, txoff, tyoff } = d.endpoints(
          view === "service" ? 1 : 0
        );
        const current = `M${sx + sxoff},${sy + syoff}L${tx + txoff},${ty +
          tyoff}`;
        return interpolatePath(previous, current);
      });

    // show the hittarget paths
    path
      .selectAll("path.hittarget")
      .style("display", "block")
      .attr("opacity", 1)
      .attr("d", d => {
        const { sx, sy, tx, ty, sxoff, syoff, txoff, tyoff } = d.endpoints(
          view === "service" ? 1 : 0
        );
        return `M${sx + sxoff},${sy + syoff}L${tx + txoff},${ty + tyoff}`;
      });
  };

  // fade out clusters and move the cluster container
  fromNamespace = nodes => {
    // show the shadow rects and then fade them out
    nodes.forEach(d => {
      d3.select(`#shadow-${d.index}`)
        .attr("transform", `translate(${d.x},${d.y})`)
        .select(".shadow-rects")
        .attr("opacity", 1)
        .style("display", "block")
        .transition()
        .duration(VIEW_DURATION)
        .attr("opacity", 0)
        .each("end", function() {
          d3.select(this).style("display", "none");
        });
    });

    // hide the real cluster rects immediately
    d3.selectAll(".cluster-rects").style("display", "none");
  };

  hideSiteLinks = () => {
    this.hideLinks("g.siteLinks");
  };

  hideServiceLinks = () => {
    this.hideLinks("g.service");
  };

  showServiceLinks = () => {
    d3.selectAll("g.service")
      .style("display", "block")
      .transition()
      .duration(VIEW_DURATION)
      .attr("opacity", 1);
  };

  hideSiteTrafficLinks = () => {
    this.hideLinks("path.sitesankey");
  };

  hideSiteServiceSankeyLinks = () => {
    this.hideLinks("path.deployment");
  };
  hideSiteServiceSankeyLinkDir = () => {
    this.hideLinks("path.deploymentDir");
  };
  hideLinks = cls => {
    d3.selectAll(cls)
      .transition()
      .duration(VIEW_DURATION)
      .attr("opacity", 0)
      .each("end", function(d) {
        d3.select(this).style("display", "none");
      });
  };
  hideSankeySiteLinkDir = () => {
    d3.selectAll("path.sitesankeyDir")
      .transition()
      .duration(VIEW_DURATION)
      .attr("opacity", 0)
      /*
      .attrTween("d", function(d, i) {
        const previous = d3.select(this).attr("d");
        const current = `M${d.source.x + d.source.getWidth()} ${d.source.y +
          d.source.getHeight() / 2} L ${d.target.x} ${d.target.y +
          d.target.getHeight() / 2 +
          i * 5}`;
        return interpolatePath(previous, current);
      })
      */
      .each("end", function(d) {
        d3.select(this).style("display", "none");
      });
  };

  hideSankeyServiceLinkDir = () => {
    d3.selectAll("path.servicesankeyDir")
      .transition()
      .duration(VIEW_DURATION)
      .attr("opacity", 0)
      .attrTween("d", function(d, i) {
        const previous = d.sankeyPath;
        const current = genPath(d);
        return interpolatePath(previous, current);
      })
      .each("end", function(d) {
        d3.select(this).style("display", "none");
      });
  };

  hideEndpoints = () => {
    d3.selectAll(".end-point")
      .transition()
      .duration(VIEW_DURATION)
      .attr("opacity", 0);
  };

  showEndpoints = () => {
    d3.selectAll(".end-point")
      .transition()
      .duration(VIEW_DURATION)
      .attr("opacity", 1);
  };

  hideExtraServices = () => {
    d3.selectAll("g.extra")
      .transition()
      .duration(VIEW_DURATION)
      .attr("transform", d => `translate(${d.original.x},${d.original.y})`)
      .each("end", function() {
        d3.select(this).style("display", "none");
      });
  };

  showExtraServices = () => {
    d3.selectAll("g.extra")
      .style("display", "block")
      //.attr("transform", d => `translate(${d.original.x},${d.original.y})`)
      .transition()
      .duration(VIEW_DURATION)
      .attr("transform", d => `translate(${d.orgx},${d.orgy})`);
  };

  recalcY = nodes => {
    nodes.forEach(n => {
      let curY = ServiceStart;
      n.subNodes.forEach(s => {
        s.expandY = curY;
        curY += s.getHeight() + ServiceGap;
      });
    });
  };

  expandCluster = (service, view, path, width) => {
    // select all the cluster boxes
    const sites = d3.selectAll("g.site");

    sites.selectAll("g.service-type").each(d => {
      if (d.x0 === 1) {
        d.x1 = d.x0 + d.getWidth();
      } else if (d.x1 === width - 1) {
        d.x0 = d.x1 - d.getWidth();
      } else {
        const curWidth = d.x1 - d.x0;
        const newWidth = d.getWidth();
        const change = (newWidth - curWidth) / 2;
        d.x0 -= change;
        d.x1 += change;
      }
    });

    // change size of all namespace boxes
    sites
      .select("rect.network")
      .transition()
      .duration(EXPAND_DURATION)
      .attr("height", d => d.getHeight())
      .attr("width", d => d.getWidth());

    // change width of the headers
    sites
      .select("rect.cluster-header")
      .transition()
      .duration(EXPAND_DURATION)
      .attr("width", d => d.getWidth());

    // move the title to the middle of the new width
    sites
      .select("text.cluster-name")
      .transition()
      .duration(EXPAND_DURATION)
      .attr("x", d => d.getWidth() / 2);

    // move the service groups to their correct y position
    sites
      .selectAll("g.service-type")
      .transition()
      .duration(EXPAND_DURATION)
      .attrTween("transform", this.tweenService(view));

    // show the versions for the selected service
    sites
      .selectAll("g.service-versions")
      .attr("opacity", d => (d.address === service.address ? 0 : 1))
      .style("display", d => (d.expanded ? "block" : "none"));

    // fade the versions in
    // Note: the non-expanded version groups will be display:none so
    // this will have no affect on them
    sites
      .selectAll("g.service-versions")
      .transition()
      .duration(EXPAND_DURATION)
      .attr("opacity", 1);

    // change the service rect sizes
    sites
      .selectAll("rect.service-type")
      .transition()
      .duration(EXPAND_DURATION)
      .attr("height", d => d.getHeight())
      .attr("width", d => d.getWidth());

    sites
      .selectAll("text.service-type")
      .transition()
      .duration(EXPAND_DURATION)
      .attr("y", d => d.getHeight() / 2);

    // move the circle on the right to the correct position
    sites
      .selectAll("circle.source")
      .transition()
      .duration(EXPAND_DURATION)
      .attr("cx", d => d.getWidth());

    if (view === "service") {
      // move links
      path
        .selectAll("path.service")
        .transition()
        .duration(VIEW_DURATION / 2)
        .attrTween("d", function(d, i) {
          const previous = d3.select(this).attr("d");
          const { sx, sy, tx, ty, sxoff, syoff, txoff, tyoff } = d.endpoints(1);
          const current = `M${sx + sxoff},${sy + syoff}L${tx + txoff},${ty +
            tyoff}`;
          return interpolatePath(previous, current);
        });
    }
  };

  tweenService = view => d => {
    const starty = d.orgy;
    return t => {
      d.orgy = starty + (d.expandY - starty) * t;
      if (view === "site") {
        return `translate(${d.orgx},${d.orgy})`;
      } else if (view === "service") {
        return `translate(${d.x}, ${d.y})`;
      } else {
        return `translate(${d.x0},${d.y0})`;
      }
    };
  };

  expandService = (d, nodes, view, path, width) => {
    return;
    /*
    d.expanded = !d.expanded;
    this.recalcY(nodes);
    this.expandCluster(d, view, path, width);
    */
  };

  // get a path that represents a rectangle
  rect2Path = rect =>
    `M${rect.x} ${rect.y} L ${rect.x + rect.width} ${rect.y} L ${rect.x +
      rect.width} ${rect.y + rect.height} L ${rect.x} ${rect.y +
      rect.height} Z`;
}

function endall(transition, callback) {
  if (typeof callback !== "function")
    throw new Error("Wrong callback in endall");
  if (transition.size() === 0) {
    callback();
  }
  var n = 0;
  transition
    .each(function() {
      ++n;
    })
    .each("end", function() {
      if (!--n) callback.apply(this, arguments);
    });
}

export default Transitions;