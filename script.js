  const width = 960, height = 960;
  const svg = d3.select("#map");

  const projection = d3.geoOrthographic()
    .scale(400)
    .translate([width / 2, height / 2])
    .clipAngle(90);

  const path = d3.geoPath(projection);
  const graticule = d3.geoGraticule10();

  const globe = svg.append("g");
  globe.append("path")
    .datum({ type: "Sphere" })
    .attr("class", "sphere")
    .attr("d", path);
  globe.append("path")
    .datum(graticule)
    .attr("class", "graticule")
    .attr("d", path);

  const landGroup = globe.append("g");
  const highlightedGroup = globe.append("g");

  let spinning = false;
  let isDragging = false;
  let lastPos = null;

async function loadHighlightedCountries(csvPath) {
  const data = await d3.csv(csvPath);
  const countryCounts = new Map();

  data.forEach(row => {
    if (!row.Country) return;

    const countries = row.Country.split(",")
      .map(c => c.trim())
      .filter(c => c.length > 0);

    countries.forEach(country => {
      countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
    });
  });

  return {
    counts: Array.from(countryCounts, ([countryName, count]) => ({ countryName, count })),
    __raw: data
  };
}

  // Load world map and CSV together
  Promise.all([
    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"),
    loadHighlightedCountries("data.csv")
  ]).then(([world, highlightedCountriesRaw]) => {
  const usecaseData = highlightedCountriesRaw.__raw; // 👈 we’ll store the raw CSV too
  const highlightedCountries = highlightedCountriesRaw.counts;
    const countries = topojson.feature(world, world.objects.countries).features;

    // Create a Set for fast lookup
    const highlightedCountrySet = new Set(highlightedCountries.map(d => d.countryName));

// Center globe on highlighted countries
const highlightedGeo = countries.filter(d => highlightedCountrySet.has(d.properties.name));
console.log(highlightedGeo)
const avgCentroid = (() => {
  const centroids = highlightedGeo.map(d => d3.geoCentroid(d));
  const n = centroids.length;
  const sum = centroids.reduce((acc, [lon, lat]) => {
    acc[0] += lon;
    acc[1] += lat;
    return acc;
  }, [0, 0]);
  return [sum[0] / n, sum[1] / n];
})();
projection.rotate([-avgCentroid[0], -avgCentroid[1]]);

redraw()

    function handleMouseOver(event, d) {
      spinning = false;
//      tooltip.style("opacity", 1).text(d.properties.name);
      d3.select(`#useCases-bar-${d.properties.name.replace(/\s+/g, "_")}`)
        .classed("hovered", true);
    }

/*    function handleMouseMove(event) {
      tooltip
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px");
    }*/

    function handleMouseOut() {
      //tooltip.style("opacity", 0);
      spinning = true;
      d3.selectAll(".useCases-bar-row").classed("hovered", false);
    }

    function handleClick(event, d) {
      const centroid = d3.geoCentroid(d);
      const rotate = projection.rotate();
      const targetRotation = [-centroid[0], -centroid[1]];

      spinning = false;
      d3.transition()
        .duration(1000)
        .tween("rotate", () => {
          const interpolate = d3.interpolate(rotate, targetRotation);
          return t => {
            projection.rotate(interpolate(t));
            showCountryProjects(d.properties.name, usecaseData);
            redraw();
          };
        });
    }

    // Draw countries
    landGroup.selectAll("path")
      .data(countries.filter(d => !highlightedCountrySet.has(d.properties.name)))
      .join("path")
      .attr("class", "country")
      .attr("d", path)
      .on("mouseover", handleMouseOver)
      //.on("mousemove", handleMouseMove)
      .on("mouseout", handleMouseOut)
      .on("click", handleClick);

    highlightedGroup.selectAll("path")
      .data(countries.filter(d => highlightedCountrySet.has(d.properties.name)))
      .join("path")
      .attr("class", "country highlighted")
      .attr("d", path)
      .on("mouseover", handleMouseOver)
      //.on("mousemove", handleMouseMove)
      .on("mouseout", handleMouseOut)
      .on("click", handleClick);

    // Drag interaction
    const drag = d3.drag()
      .on("start", (event) => {
        isDragging = true;
        spinning = false;
        lastPos = [event.x, event.y];
      })
      .on("drag", (event) => {
        const [x, y] = [event.x, event.y];
        const [dx, dy] = [x - lastPos[0], y - lastPos[1]];
        const rotation = projection.rotate();
        projection.rotate([
          rotation[0] + dx * 0.5,
          Math.max(-90, Math.min(90, rotation[1] - dy * 0.5))
        ]);
        lastPos = [x, y];
        redraw();
      })
      .on("end", () => {
        isDragging = false;
        spinning = true;
      });

    svg.call(drag);

    // Zoom interaction
    svg.call(d3.zoom()
      .scaleExtent([0.5, 4])
      .on("zoom", (event) => {
        projection.scale(400 * event.transform.k);
        redraw();
      }));

    function redraw() {
      globe.select(".sphere").attr("d", path);
      globe.select(".graticule").attr("d", path);
      landGroup.selectAll("path").attr("d", path);
      highlightedGroup.selectAll("path").attr("d", path);
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        spinning = entry.isIntersecting;
      });
    }, { threshold: 0.1 });

    observer.observe(svg.node());

function animate() {
  requestAnimationFrame(animate);
}

    animate();

// add bar Graph

const maxCount = d3.max(highlightedCountries, d => d.count);

// Sort data descending
const sortedData = [...highlightedCountries].sort((a, b) => b.count - a.count);

// Select the container
const container = d3.select("#useCases-barGraph");

// Clear previous content if needed
container.html("");

// Append one div per country
sortedData.forEach(d => {
  const countryId = d.countryName.replace(/\s+/g, "_");

  const barWrapper = container
    .append("div")
    .attr("id", `useCases-bar-${countryId}`)
    .attr("class", "useCases-bar-row")
    .on("mouseenter", () => {
      d3.selectAll("path.country")
        .filter(p => p.properties.name === d.countryName)
        .classed("hovered", true);

    //rotates globe

    const matched = countries.find(c => c.properties.name === d.countryName);
      if (!matched) return;

      const centroid = d3.geoCentroid(matched);
      const currentRotation = projection.rotate();
      const targetRotation = [-centroid[0], -centroid[1]];

      spinning = false;
      d3.transition()
        .duration(1000)
        .tween("rotate", () => {
          const interpolate = d3.interpolate(currentRotation, targetRotation);
          return t => {
            projection.rotate(interpolate(t));
            redraw();
          };
        });

    })
    .on("mouseleave", () => {
      d3.selectAll("path.country").classed("hovered", false);
    })
    .on("click", () => {
  const matched = countries.find(c => c.properties.name === d.countryName);
  if (!matched) return;

  const centroid = d3.geoCentroid(matched);
  const currentRotation = projection.rotate();
  const targetRotation = [-centroid[0], -centroid[1]];

  spinning = false;
  d3.transition()
    .duration(1000)
    .tween("rotate", () => {
      const interpolate = d3.interpolate(currentRotation, targetRotation);
      return t => {
        projection.rotate(interpolate(t));
        redraw();
      };
    });

  // Show popup
  showCountryProjects(d.countryName, usecaseData);
});

  barWrapper
    .append("div")
    .attr("class", "bar-label")
    .text(d.countryName);

  const barContainer = barWrapper
    .append("div")
    .attr("class", "bar-container");

  barContainer
    .append("div")
    .attr("class", "bar-fill")
    .style("width", `${(d.count / maxCount) * 100}%`)
    .text(d.count);
});

//Update introductory text

d3.select("#countryCount").html(maxCount)
d3.select("#usecaseCount").html(usecaseData.length)


// add overlay

function showCountryProjects(countryName, rawData) {
  const overlay = d3.select("#useCases-overlay");
  const title = d3.select("#overlay-title");
  const projectList = d3.select("#overlay-projects");

  // Filter projects that include the country
  const countryProjects = rawData.filter(d =>
    d.Country && d.Country.split(",").map(c => c.trim()).includes(countryName)
  );

  // Sort by title
  countryProjects.sort((a, b) => d3.ascending(a.Title, b.Title));

  // Fill overlay content
  title.text(`Use cases in ${countryName}`);
  projectList.html(""); // Clear old content

  if (countryProjects.length === 0) {
    projectList.append("p").text("No projects found.");
  } else {
    countryProjects.forEach(proj => {
      const entry = projectList.append("div").attr("class", "project-entry");
      entry.append("h4").text(proj.Title);
      entry.append("p").text(proj.Description || "No description provided.");
    });
  }

  overlay.style("display", "flex");
}

  });

d3.select('.close-btn').on("click", () => {
  d3.select('#useCases-overlay').style("display", "none")
})
