    require([
      "esri/Map",
      "esri/views/MapView",
      "esri/layers/FeatureLayer",
      "esri/layers/WMSLayer",
      "esri/layers/GraphicsLayer",
      "esri/layers/MapImageLayer",
      "esri/widgets/Sketch",
      "esri/widgets/Home",
      "esri/widgets/Locate",
      "esri/widgets/Measurement",
      "esri/widgets/Expand",
      "esri/geometry/geometryEngine",
      "esri/Basemap",
      "esri/geometry/SpatialReference",
      "esri/geometry/projection",
      "esri/Graphic",
      "esri/identity/OAuthInfo",
      "esri/identity/IdentityManager"
    ], function (EsriMap, MapView, FeatureLayer, WMSLayer, GraphicsLayer, MapImageLayer, Sketch, Home, Locate, Measurement, Expand, geometryEngine, Basemap, SpatialReference, projection, Graphic, OAuthInfo, esriId) {

      // Replace this placeholder with the App ID from the registered RARIK Portal application.
      const RARIK_PORTAL_URL = "https://kort.rarik.is/portal";
      const RARIK_PORTAL_SHARING_URL = RARIK_PORTAL_URL + "/sharing";
      const RARIK_OAUTH_APP_ID = "jfTe4e2O3m6fDIZk";
      const authPanel = document.getElementById("rarikAuthPanel");
      const authText = document.getElementById("rarikAuthText");
      const authButton = document.getElementById("rarikAuthButton");

      function setAuthState(text, buttonText, buttonVisible) {
        if (authText) authText.textContent = text;
        if (authButton) {
          authButton.textContent = buttonText || "Skrá inn";
          authButton.style.display = buttonVisible ? "inline-flex" : "none";
        }
        if (authPanel) authPanel.style.display = "flex";
      }

      const oauthConfigured = RARIK_OAUTH_APP_ID !== "PASTE_RARIK_PORTAL_APP_ID_HERE";
      if (oauthConfigured) {
        esriId.registerOAuthInfos([new OAuthInfo({
          appId: RARIK_OAUTH_APP_ID,
          portalUrl: RARIK_PORTAL_URL,
          popup: false,
          preserveUrlHash: true
        })]);
        setAuthState("Athuga innskráningu í RARIK Portal...", "Skrá inn", false);
        esriId.checkSignInStatus(RARIK_PORTAL_SHARING_URL)
          .then(function () {
            setAuthState("Innskráð/ur í RARIK Portal", "Skrá út", true);
            authButton.onclick = function () {
              esriId.destroyCredentials();
              window.location.reload();
            };
          })
          .catch(function () {
            setAuthState("RARIK-lög krefjast innskráningar", "Skrá inn", true);
            authButton.onclick = function () {
              esriId.getCredential(RARIK_PORTAL_SHARING_URL);
            };
          });
      } else {
        setAuthState("Vantar App ID fyrir RARIK Portal", "Leiðbeiningar", true);
        authButton.onclick = function () {
          alert("Skráðu vefsjána sem Web Mapping Application í RARIK Portal og settu App ID í RARIK_OAUTH_APP_ID efst í app_oauth.js.");
        };
      }

      const loftmyndirLayer = new WMSLayer({
        url: "https://tc.map.is/mapcache",
        sublayers: [{ name: "myndkort" }],
        title: "Loftmyndir (Loftmyndir ehf.)",
        copyright: "Loftmyndir ehf. — Fyrir leyfishafa RARIK. Aðeins til innanhúss notkunar."
      });

      const loftmyndirBasemap = new Basemap({
        baseLayers: [loftmyndirLayer],
        title: "Loftmyndir",
        id: "loftmyndir"
      });

      const orkukaupendurLayer = new FeatureLayer({
        url: "https://kort.rarik.is/server/rest/services/Hosted/Truflanir_OK/FeatureServer",
        title: "Orkukaupendur",
        outFields: ["*"],
        popupEnabled: false,
        visible: false,
        minScale: 0,
        maxScale: 0
      });

      const orkukaupendur = { layer: orkukaupendurLayer, config: { title: "Orkukaupendur", institution: "Rarik", statusElId: "status-orkukaupendur", info: "Orkukaupendur RARIK, hýst í ArcGIS Enterprise (kort.rarik.is)." } };

      function createRarikHonnunLayer(id, title, statusId) {
        return {
          layer: new MapImageLayer({
            url: "https://s-rek-arcgis-y1.rarik.is/arcgis/rest/services/Framkvaemdir/RarikHonnun/MapServer",
            sublayers: [{ id: id, visible: true }],
            title: title,
            visible: false
          }),
          config: {
            title: title,
            institution: "Rarik",
            subgroup: "Rafveita hönnun",
            statusElId: statusId,
            info: title + " frá RARIK."
          }
        };
      }

      const rarikHonnunCableServiceUrl = "https://kort.rarik.is/server/rest/services/L%C3%A1gspennustrengur_h%C3%B6nnun/FeatureServer";

      function createRarikHonnunCableLayer(id, title, statusId, usage) {
        return {
          layer: new FeatureLayer({
            url: rarikHonnunCableServiceUrl + "/" + id,
            title: title,
            outFields: ["*"],
            popupEnabled: false,
            visible: false,
            definitionExpression: "NOTKUN_STRENGS = '" + usage + "'"
          }),
          config: {
            title: title,
            institution: "Rarik",
            subgroup: "Rafveita hönnun",
            statusElId: statusId,
            geometryType: "polyline",
            info: title + " frá RARIK."
          }
        };
      }

      const designLayerRarik = createRarikHonnunCableLayer(129, "HV Strengur hönnun", "status-rarik-honnun", "HÁSP.STR");
      const lvStrengurHonnun = createRarikHonnunCableLayer(129, "LV Strengur Hönnun", "status-rarik-lv-strengur-honnun", "HEIMTAUG");
      const hvLoftlinaHonnun = createRarikHonnunLayer(8, "HV Loftlína hönnun", "status-rarik-hv-loftlina-honnun");
      const dreifistodHonnun = createRarikHonnunLayer(7, "Dreifistöð hönnun", "status-rarik-dreifistod-honnun");
      const adveitustodHonnun = createRarikHonnunLayer(6, "Aðveitustöð hönnun", "status-rarik-adveitustod-honnun");

      const gpsMaelingarSymbol = {
        type: "simple-line",
        color: [0, 0, 255, 1],
        width: 1.5
      };
      const gpsMaelingar = {
        layer: new FeatureLayer({
          url: "https://s-rek-arcgis-y1.rarik.is/arcgis/rest/services/Framkvaemdir/RarikHonnun/MapServer/12",
          title: "GPS mælingar",
          outFields: ["*"],
          popupEnabled: false,
          visible: false,
          renderer: {
            type: "simple",
            symbol: gpsMaelingarSymbol
          }
        }),
        config: {
          title: "GPS mælingar",
          institution: "Rarik",
          statusElId: "status-rarik-gps-maelingar",
          geometryType: "polyline",
          renderer: {
            type: "simple",
            symbol: gpsMaelingarSymbol
          },
          info: "GPS-mælingar frá RARIK."
        }
      };

      function createRarikOperationalLayer(id, title, geometryType, statusId, subgroup) {
        return {
          layer: new FeatureLayer({
            url: "https://s-rek-arcgis-y1.rarik.is/arcgis/rest/services/Framkvaemdir/RarikDreifikerfi/MapServer/" + id,
            title: title,
            outFields: ["*"],
            popupEnabled: false,
            visible: false
          }),
          config: {
            title: title,
            institution: "Rarik",
            subgroup: subgroup || "Rafveita í rekstri",
            statusElId: statusId,
            geometryType: geometryType,
            info: title + " í rafveitukerfi RARIK."
          }
        };
      }

      const aflStodRekstri = createRarikOperationalLayer(0, "Aflstöð", "point", "status-rarik-aflstod");
      const adveitustodRekstri = createRarikOperationalLayer(1, "Aðveitustöð", "point", "status-rarik-adveitustod-rekstri");
      const loftlinaRekstri = createRarikOperationalLayer(2, "Loftlína", "polyline", "status-rarik-loftlina-rekstri");
      const jardstrengurRekstri = createRarikOperationalLayer(3, "Jarðstrengur", "polyline", "status-rarik-jardstrengur-rekstri");
      const hitaveitulogn = createRarikOperationalLayer(4, "Hitaveitulögn", "polyline", "status-rarik-hitaveitulogn", "Rarik hitaveita");
      const hitaveitur = createRarikOperationalLayer(9, "Hitaveitur", "point", "status-rarik-hitaveitur", "Rarik hitaveita");

      const loftlinaVoltageLegend = [
        { value: -1, label: "Uppsett = R", color: [0, 0, 139, 1] },
        { value: 1, label: "1 kV", color: [0, 122, 255, 1] },
        { value: 6, label: "6 kV", color: [164, 108, 34, 1] },
        { value: 11, label: "11 kV", color: [28, 213, 73, 1] },
        { value: 19, label: "19 kV", color: [220, 0, 210, 1] },
        { value: 22, label: "22 kV", color: [255, 0, 170, 1] },
        { value: 33, label: "33 kV", color: [255, 0, 255, 1] },
        { value: 66, label: "66 kV", color: [0, 75, 255, 1] },
        { value: 132, label: "132 kV", color: [128, 0, 255, 1] },
        { value: 0.4, label: "0.4 kV", color: [0, 191, 255, 1] },
        { value: 0.46, label: "0.46 kV", color: [64, 224, 208, 1] },
        { label: "Aflag/óreilt", color: [0, 0, 0, 1] }
      ];
      const loftlinaVoltageRenderer = {
        type: "unique-value",
        valueExpression: "IIF($feature.UPPSETT == 'R', -1, $feature.SPENNA)",
        defaultLabel: "Aflag/óreilt",
        symbol: {
          type: "simple-line",
          color: [0, 0, 0, 1],
          width: 2
        },
        defaultSymbol: {
          type: "simple-line",
          color: [0, 0, 0, 1],
          width: 2
        },
        uniqueValueInfos: loftlinaVoltageLegend
          .filter(function (item) { return item.value !== undefined; })
          .map(function (item) {
            return {
              value: item.value,
              label: item.label,
              symbol: {
                type: "simple-line",
                color: item.color,
                width: 2
              }
            };
          })
      };
      loftlinaRekstri.layer.renderer = loftlinaVoltageRenderer;
      loftlinaRekstri.config.renderer = loftlinaVoltageRenderer;
      loftlinaRekstri.config.legendItems = loftlinaVoltageLegend;
      loftlinaRekstri.config.legendLineStyle = "solid";

      const jardstrengurVoltageLegend = [
        { value: -5, label: "HEIMTAUG – Uppsett = L", color: [255, 0, 0, 1] },
        { value: -4, label: "HEIMTAUG – Uppsett = V", color: [0, 0, 139, 1] },
        { value: -3, label: "STOFNSTR. – Uppsett = L", color: [255, 0, 0, 1] },
        { value: -2, label: "STOFNSTR.", color: [160, 32, 129, 1] },
        { value: -1, label: "Uppsett = R", color: [0, 0, 139, 1] },
        { value: 0.4, label: "0.4 kV", color: [0, 191, 255, 1] },
        { value: 0.46, label: "0.46 kV", color: [64, 224, 208, 1] },
        { value: 6.6, label: "6 kV", color: [164, 108, 34, 1] },
        { value: 11, label: "11 kV", color: [0, 235, 65, 1] },
        { value: 19, label: "19 kV", color: [220, 0, 210, 1] },
        { value: 22, label: "22 kV", color: [190, 0, 255, 1] },
        { value: 33, label: "33 kV", color: [255, 128, 0, 1] },
        { value: 66, label: "66 kV", color: [255, 128, 0, 1] }
      ];
      const jardstrengurVoltageRenderer = {
        type: "unique-value",
        valueExpression: "When(Upper(Trim($feature.NOTKUN_STRENGS)) == 'HEIMTAUG' && Upper(Trim($feature.UPPSETT)) == 'L', -5, Upper(Trim($feature.NOTKUN_STRENGS)) == 'HEIMTAUG' && Upper(Trim($feature.UPPSETT)) == 'V', -4, (Upper(Trim($feature.NOTKUN_STRENGS)) == 'STOFNSTR.' || Upper(Trim($feature.NOTKUN_STRENGS)) == 'STOFNSTR') && Upper(Trim($feature.UPPSETT)) == 'L', -3, Upper(Trim($feature.NOTKUN_STRENGS)) == 'STOFNSTR.' || Upper(Trim($feature.NOTKUN_STRENGS)) == 'STOFNSTR', -2, $feature.UPPSETT == 'R', -1, $feature.SPENNA)",
        defaultLabel: "Aflag/óreilt",
        symbol: {
          type: "simple-line",
          color: [0, 0, 0, 1],
          width: 2,
          style: "dash"
        },
        defaultSymbol: {
          type: "simple-line",
          color: [0, 0, 0, 1],
          width: 2,
          style: "dash"
        },
        uniqueValueInfos: jardstrengurVoltageLegend.map(function (item) {
          return {
            value: item.value,
            label: item.label,
            symbol: {
              type: "simple-line",
              color: item.color,
              width: 2,
              style: "dash"
            }
          };
        })
      };
      jardstrengurRekstri.layer.renderer = jardstrengurVoltageRenderer;
      jardstrengurRekstri.config.renderer = jardstrengurVoltageRenderer;
      jardstrengurRekstri.config.legendItems = jardstrengurVoltageLegend;
      jardstrengurRekstri.config.legendLineStyle = "dash";

      const flokkar = {
        layer: new FeatureLayer({
          url: "https://utver.vegagerdin.is/server/rest/services/vegakerfi/MapServer/11",
          title: "Flokkar",
          outFields: ["*"],
          popupEnabled: false,
          visible: false,
          labelsVisible: true,
          labelingInfo: [{
            labelExpressionInfo: {
              expression: "Concatenate($feature.KAFLIVEGURHEITI, ' ', $feature.NRVEGUR, '-', $feature.NRKAFLI)"
            },
            labelPlacement: "center-along",
            symbol: {
              type: "text",
              color: "#222222",
              haloColor: "#ffffff",
              haloSize: 1,
              font: {
                family: "Arial",
                size: 9,
                weight: "bold"
              }
            }
          }]
        }),
        config: {
          title: "Flokkar",
          institution: "Vegagerðin",
          statusElId: "status-vegagerdin-flokkar",
          geometryType: "polyline",
          color: [255, 0, 0, 1],
          info: "Vegflokkar á Íslandi.\n\nHeimild: Vegagerðin",
          legendItems: [
            { label: "1 – Stofnvegur (S)", color: [255, 0, 0, 1] },
            { label: "8 – Stofnvegur um hálendi (Sx)", color: [255, 255, 255, 1] },
            { label: "2 – Tengivegur (T)", color: [76, 230, 0, 1] },
            { label: "4 – Landsvegur (L)", color: [230, 152, 0, 1] },
            { label: "3 – Héraðsvegur (H)", color: [0, 92, 230, 1] },
            { label: "11 – Skilavegur", color: [255, 255, 0, 1] },
            { label: "9 – Áningastaður (An)", color: [115, 223, 255, 1] },
            { label: "7 – Ferja", color: [190, 210, 255, 1] }
          ]
        }
      };

      const stodvasetning = {
        layer: new MapImageLayer({
          url: "https://utver.vegagerdin.is/server/rest/services/vegakerfi/MapServer",
          title: "Stöðvasetning",
          visible: false,
          sublayers: [{
            id: 6,
            visible: true
          }, {
            id: 7,
            visible: true
          }, {
            id: 8,
            visible: true
          }]
        }),
        config: {
          title: "Stöðvasetning",
          institution: "Vegagerðin",
          statusElId: "status-vegagerdin-stodvasetning",
          geometryType: "point",
          color: [255, 0, 0, 1],
          info: "Stöðvasetning úr Vegagerðarkerfi. Sýnir stöðvar í mismunandi þéttleika eftir mælikvarða: 500 m, 100 m og 20 m."
        }
      };

      const arcgisFeatureLayers = [
        orkukaupendur, gpsMaelingar,
        designLayerRarik, lvStrengurHonnun, hvLoftlinaHonnun, dreifistodHonnun, adveitustodHonnun,
        aflStodRekstri, adveitustodRekstri, loftlinaRekstri, jardstrengurRekstri,
        hitaveitulogn, hitaveitur,
        flokkar, stodvasetning,
      ];

      const map = new EsriMap({
        basemap: loftmyndirBasemap
      });

      map.addMany(arcgisFeatureLayers.map(function (l) { return l.layer; }));

      const view = new MapView({
        container: "viewDiv",
        map: map,
        spatialReference: new SpatialReference({ wkid: 3057 }),
        extent: {
          xmin: -23.0,
          ymin: 63.9,
          xmax: -15.0,
          ymax: 66.0,
          spatialReference: { wkid: 4326 }
        }
      });

      const coordinateDisplay = document.getElementById("coordinateDisplay");
      const wgs84 = new SpatialReference({ wkid: 4326 });
      let projectionReady = false;
      let selectedCoordinatePoint = null;

      function showCoordinates(mapPoint, isSelected) {
        const isn93Text = "ISN93: " + mapPoint.x.toFixed(2) + ", " + mapPoint.y.toFixed(2) + " - Smelltu á stað til að festa hnit";
        const prefix = isSelected ? "" : "";
        if (!projectionReady) {
          coordinateDisplay.textContent = prefix + "DD: reikna... | " + isn93Text;
          return;
        }

        const geographicPoint = projection.project(mapPoint, wgs84);
        if (!geographicPoint) {
          coordinateDisplay.textContent = prefix + "DD: ófáanlegt | " + isn93Text;
          return;
        }

        coordinateDisplay.textContent =
          prefix + "DD: " + geographicPoint.y.toFixed(6) + ", " + geographicPoint.x.toFixed(6) +
          " | " + isn93Text;
      }

      projection.load().then(function () {
        projectionReady = true;
        if (selectedCoordinatePoint) {
          showCoordinates(selectedCoordinatePoint, true);
        }
      }).catch(function (error) {
        coordinateDisplay.textContent = "Hnitavörpun mistókst";
        console.error("Hnitavörpun fyrir hnitabirtingu mistókst:", error);
      });

      view.on("pointer-move", function (event) {
        if (selectedCoordinatePoint) return;
        const mapPoint = view.toMap(event);
        if (!mapPoint) return;
        showCoordinates(mapPoint, false);
      });

      view.on("click", function (event) {
        selectedCoordinatePoint = view.toMap(event);
        if (selectedCoordinatePoint) {
          showCoordinates(selectedCoordinatePoint, true);
        }
      });

      const homeWidget = new Home({
        view: view
      });
      view.ui.add(homeWidget, { position: "top-left", index: 1 });

      const locateWidget = new Locate({ view: view });
      view.ui.add(locateWidget, { position: "top-left", index: 3 });

      function createLiveBBoxLayer(config) {
        const attributeFields = (config.attributeFields || []).concat(
          config.showLabels && config.labelField ? [config.labelField] : []
        );
        const extraFields = Array.from(new Set(attributeFields)).map(function (f) {
          return { name: f, type: "string" };
        });
        const layer = new FeatureLayer({
          source: [],
          objectIdField: "OBJECTID",
          fields: [{ name: "OBJECTID", type: "oid" }].concat(extraFields),
          geometryType: config.geometryType || "polygon",
          spatialReference: { wkid: 3057 },
          title: config.title,
          renderer: config.renderer,
          labelsVisible: !!config.showLabels,
          labelingInfo: config.showLabels ? [{
            labelExpressionInfo: { expression: "$feature." + config.labelField },
            labelPlacement: "always-horizontal",
            symbol: {
              type: "text",
              color: [0, 0, 0, 1],
              haloColor: [255, 255, 255, 0.9],
              haloSize: 1,
              font: {
                family: "Arial",
                size: 9,
                weight: "bold"
              }
            }
          }] : [],
          visible: false
        });

        const attributesCache = new Map();

        let lastRequestId = 0;
        let nextObjectId = 1;

        async function refreshForExtent(extent) {
          const requestId = ++lastRequestId;
          const bbox = (config.swapBboxAxes
            ? [extent.ymin, extent.xmin, extent.ymax, extent.xmax]
            : [extent.xmin, extent.ymin, extent.xmax, extent.ymax]).join(",");
          const spatialFilter = "BBOX(" + (config.geometryField || "geom") + "," +
            bbox + ",'EPSG:3057')";
          const url = config.url +
            "?service=WFS&version=2.0.0&request=GetFeature" +
            "&typeName=" + encodeURIComponent(config.typeName) +
            "&outputFormat=" + (config.outputFormat || "application/json") +
            "&srsName=EPSG:3057" +
            (config.cqlFilter
              ? "&CQL_FILTER=" + encodeURIComponent("(" + config.cqlFilter + ") AND " + spatialFilter)
              : "&bbox=" + bbox + ",EPSG:3057") +
            "&count=2000";

          try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("HTTP " + response.status);
            const geojson = await response.json();

            if (requestId !== lastRequestId) return;

            const geomType = config.geometryType || "polygon";

            const graphics = (geojson.features || [])
              .map(function (f) {
                if (!f.geometry) return null;

                let esriGeometry;

                if (geomType === "point") {
                  if (f.geometry.type === "Point") {
                    esriGeometry = {
                      type: "point",
                      x: f.geometry.coordinates[0],
                      y: f.geometry.coordinates[1],
                      spatialReference: { wkid: 3057 }
                    };
                  } else if (f.geometry.type === "MultiPoint") {
                    esriGeometry = {
                      type: "point",
                      x: f.geometry.coordinates[0][0],
                      y: f.geometry.coordinates[0][1],
                      spatialReference: { wkid: 3057 }
                    };
                  } else {
                    console.warn(config.title + ": vænti Point, fékk " + f.geometry.type);
                    return null;
                  }
                } else if (geomType === "polyline") {
                  let paths;
                  if (f.geometry.type === "LineString") {
                    paths = [f.geometry.coordinates];
                  } else if (f.geometry.type === "MultiLineString") {
                    paths = f.geometry.coordinates;
                  } else {
                    console.warn(config.title + ": vænti LineString, fékk " + f.geometry.type);
                    return null;
                  }
                  esriGeometry = {
                    type: "polyline",
                    paths: paths,
                    spatialReference: { wkid: 3057 }
                  };
                } else {
                  let rings;
                  if (f.geometry.type === "Polygon") {
                    rings = f.geometry.coordinates;
                  } else if (f.geometry.type === "MultiPolygon") {
                    rings = f.geometry.coordinates.reduce(function (acc, poly) {
                      return acc.concat(poly);
                    }, []);
                  } else {
                    console.warn(config.title + ": óstudd rúmfræðitegund - " + f.geometry.type);
                    return null;
                  }
                  esriGeometry = {
                    type: "polygon",
                    rings: rings,
                    spatialReference: { wkid: 3057 }
                  };
                }

                const objectId = nextObjectId++;
                attributesCache.set(objectId, f.properties || {});

                const graphicAttrs = { OBJECTID: objectId };
                attributeFields.forEach(function (fieldName) {
                  graphicAttrs[fieldName] = f.properties ? String(f.properties[fieldName]) : null;
                });

                return {
                  geometry: esriGeometry,
                  attributes: graphicAttrs
                };
              })
              .filter(function (g) { return g !== null; });

            await layer.applyEdits({
              deleteFeatures: (await layer.queryFeatures()).features,
              addFeatures: graphics
            });

            const statusEl = document.getElementById(config.statusElId);
            statusEl.className = "layerRowStatus ok";
            statusEl.textContent =
              "✅ " + graphics.length + "/" +
              (geojson.features || []).length + " feiturur á svæði";
          } catch (err) {
            const statusEl = document.getElementById(config.statusElId);
            statusEl.className = "layerRowStatus fail";
            statusEl.textContent = "❌ villa: " + err.message;
            console.error(config.title, err);
          }
        }

        return { layer, refreshForExtent, attributesCache, config };
      }

      function createArcgisFeatureLayer(config) {
        const layer = new FeatureLayer({
          url: config.url,
          title: config.title,
          outFields: ["*"],
          popupEnabled: false,
          labelsVisible: false,
          minScale: 0,
          maxScale: 0,
          visible: false,
          renderer: {
            type: "simple",
            symbol: {
              type: "simple-line",
              color: config.color,
              width: config.width || 2,
              style: config.style || "solid"
            }
          }
        });
        return { layer, config: config };
      }


      function createVatnshlotFeatureLayer(id, title, description) {
        return {
          layer: new FeatureLayer({
            url: "https://luk.vedur.is/arcgis/rest/services/vatnamal/stjvm_vatnshlot_v2021_isn93/MapServer/" + id,
            title: title,
            outFields: ["*"],
            popupEnabled: false,
            visible: false,
            minScale: 0,
            maxScale: 0
          }),
          config: {
            title: title,
            statusElId: "status-vatnshlot-" + id,
            institution: "Vatnshlot",
            geometryType: id === 4 ? "polyline" : "polygon",
            labelField: "Name",
            info: description
          }
        };
      }

      const vatnshlotaflokkur = {
        layer: new MapImageLayer({
          url: "https://luk.vedur.is/arcgis/rest/services/vatnamal/stjvm_eiginleikagreining_v2021_isn93/MapServer",
          title: "Vatnshlotaflokkur",
          sublayers: [
            { id: 1, visible: true },
            { id: 2, visible: true },
            { id: 39, visible: true },
            { id: 3, visible: true }
          ],
          visible: false,
          minScale: 0,
          maxScale: 0
        }),
        config: {
          title: "Vatnshlotaflokkur",
          statusElId: "status-vatnshlotaflokkur",
          institution: "Vatnshlot",
          geometryType: "polygon",
          info: "Gerðargreining yfirborðshlota samkvæmt lögum um stjórn vatnamála.\n\nHeimild: Veðurstofa Íslands."
        }
      };

      const arosavatnshlot = createVatnshlotFeatureLayer(
        0,
        "Árósavatnshlot",
        "Skilgreind strandlón og árósahlot.\n\nHeimild: Hafrannsóknastofnun og Náttúrufræðistofnun Íslands."
      );
      const strandsjavarhlot = createVatnshlotFeatureLayer(
        1,
        "Strandsjávarhlot",
        "Skilgreind strandsjávarhlot.\n\nHeimild: Hafrannsóknastofnun."
      );
      const stoduvatnshlot = createVatnshlotFeatureLayer(
        3,
        "Stöðuvatnshlot",
        "Skilgreind stöðuvatnshlot.\n\nHeimild: Veðurstofa Íslands og Hafrannsóknastofnun."
      );
      const straumvatnshlot = createVatnshlotFeatureLayer(
        4,
        "Straumvatnshlot",
        "Skilgreind straumvatnshlot.\n\nHeimild: Veðurstofa Íslands og Hafrannsóknastofnun."
      );
      const grunnvatnshlot = createVatnshlotFeatureLayer(
        2,
        "Grunnvatnshlot",
        "Skilgreind grunnvatnshlot.\n\nHeimild: Veðurstofa Íslands."
      );

      const vatnshlotLayers = [
        arosavatnshlot,
        strandsjavarhlot,
        stoduvatnshlot,
        straumvatnshlot,
        grunnvatnshlot
      ];
      arcgisFeatureLayers.push.apply(arcgisFeatureLayers, vatnshlotLayers);
      map.addMany(vatnshlotLayers.map(function (l) { return l.layer; }));

      const fridlyst = createLiveBBoxLayer({
        url: "https://gis.ust.is/geoserver/wfs",
        typeName: "fridlyst_svaedi:fridlyst_svaedi",
        title: "Friðlýst svæði",
        institution: "Náttúruverndarstofnun",
        statusElId: "status-fridlyst",
        labelField: "site_name",
        linkifyUrls: true,
        info: "Friðlýst svæði á Íslandi frá Náttúruverndarstofnun, skv. evrópska CDDA-staðlinum (Common Database on Designated Areas). Inniheldur IUCN-verndarflokk og friðlýsingarár.\n\nHeimild: Náttúruverndarstofnun",
        renderer: {
          type: "simple",
          symbol: {
            type: "simple-fill",
            color: [76, 175, 80, 0.4],
            outline: { color: [46, 125, 50, 0.9], width: 0.5 }
          }
        }
      });

      const vatnsvernd = createLiveBBoxLayer({
        url: "https://gis.ust.is/geoserver/wfs",
        typeName: "fridlyst_svaedi:fridlyst_svaedi_vatnsvernd",
        title: "Vatnsverndarsvæði friðlýsinga",
        institution: "Náttúruverndarstofnun",
        statusElId: "status-vatnsvernd",
        labelField: "nafn",
        linkifyUrls: true,
        info: "Vatnsverndarsvæði tengd friðlýsingum frá Náttúruverndarstofnun.\n\nHeimild: Náttúruverndarstofnun",
        renderer: {
          type: "simple",
          symbol: {
            type: "simple-fill",
            color: [3, 169, 244, 0.35],
            outline: { color: [2, 119, 189, 0.9], width: 0.5, style: "dash" }
          }
        }
      });

      const thjodlendur = createLiveBBoxLayer({
        url: "https://gis.is/geoserver/wfs",
        typeName: "obyggdanefnd:TH",
        title: "Þjóðlendur",
        institution: "Náttúruverndarstofnun",
        statusElId: "status-thjodlendur",
        geometryType: "polygon",
        info: "Þjóðlendulínur (þ.e. mörk eignarlanda og þjóðlenda) skv. úrskurðum óbyggðanefndar eða dómum dómstóla eftir því sem við á.\n\nHeimild: Forsætisráðuneytið / Óbyggðanefnd",
        attributeFields: ["tegund2"],
        legendItems: [
          { color: [215, 215, 158, 0.9], label: "Þjóðlenda á jökli" },
          { color: [255, 255, 0, 0.9], label: "Þjóðlenda" },
          { color: [245, 122, 182, 0.9], label: "Afréttur" },
          { color: [0, 255, 197, 0.9], label: "Afréttareign" }
        ],
        renderer: {
          type: "unique-value",
          field: "tegund2",
          symbol: {   // <-- þarf að vera til staðar svo swatch-liturinn í statusPanel virki
            type: "simple-fill",
            color: [200, 200, 200, 0.5],
            outline: { color: [110, 110, 110, 0.9], width: 0.5 }
          },
          defaultSymbol: {
            type: "simple-fill",
            color: [158, 158, 158, 0.35],
            outline: { color: [110, 110, 110, 0.9], width: 0.5 }
          },
          uniqueValueInfos: [
            {
              value: "Þjóðlenda á jökli",
              label: "Þjóðlenda á jökli",
              symbol: {
                type: "simple-fill",
                color: [215, 215, 158, 0.55],
                outline: { color: [181, 180, 158, 0.9], width: 0.5 }
              }
            },
            {
              value: "Þjóðlenda",
              label: "Þjóðlenda",
              symbol: {
                type: "simple-fill",
                color: [255, 255, 0, 0.65],
                outline: { color: [217, 180, 40, 0.9], width: 0.5 }
              }
            },
            {
              value: "Afréttur",
              label: "Afréttur",
              symbol: {
                type: "simple-fill",
                color: [245, 122, 182, 0.6],
                outline: { color: [223, 99, 182, 0.9], width: 0.5 }
              }
            },
            {
              value: "Afréttareign",
              label: "Afréttareign",
              symbol: {
                type: "simple-fill",
                color: [0, 255, 197, 0.7],
                outline: { color: [0, 218, 197, 0.9], width: 0.5 }
              }
            }
          ]
        }
      });

      const landeignaskraConfig = {
        url: "https://gis.fasteignaskra.is/geoserver/wfs",
        imageUrl: "https://landeignaskra.hms.is/api/geo/wms/landeign",
        layerName: "public:Landeignaskra",
        typeName: "public:Landeignaskra",
        title: "Landeignaskrá",
        institution: "HMS",
        statusElId: "status-landeignaskra",
        geometryType: "polygon",
        info: "Landeignaskrá frá HMS. Aðeins hluti allra landeigna sem skráðar eru í fasteignaskrá er að finna hér.\n\nHeimild: Húsnæðis-, mannvirkja og skipulagsstofnun",
        renderer: {
          type: "simple",
          symbol: {
            type: "simple-fill",
            color: [255, 235, 59, 0.3],
            outline: { color: [245, 127, 23, 0.9], width: 0.75 }
          }
        }
      };
      const landeignaskra = createLiveBBoxLayer(landeignaskraConfig);

      const aaetladEignamorkConfig = {
        url: "https://landeignaskra.hms.is/api/geo/wms/aaetlun/landeign",
        identifyUrl: "https://geo.fasteignaskra.is/ws/geoserver/wfs",
        typeName: "Jardir:MV_AE_SKIKI_GEOSERVER_0102",
        title: "Áætluð eignamörk",
        institution: "HMS",
        statusElId: "status-aaetlad-eignamork",
        info: "Áætluð eignamörk úr Landeignaskrá HMS."
      };
      const aaetladEignamork = {
        layer: new GraphicsLayer({
          title: aaetladEignamorkConfig.title,
          visible: false,
          listMode: "hide"
        }),
        config: aaetladEignamorkConfig
      };
      const ornefniConfig = {
        imageUrl: "https://landeignaskra.hms.is/api/geo/wms/ornefni",
        title: "Örnefni",
        institution: "HMS",
        statusElId: "status-ornefni",
        info: "Örnefni úr Landeignaskrá HMS."
      };
      const ornefni = {
        layer: new GraphicsLayer({
          title: ornefniConfig.title,
          visible: false,
          listMode: "hide"
        }),
        config: ornefniConfig
      };
      const sveitarfelogConfig = {
        imageUrl: "https://landeignaskra.hms.is/api/geo/wms/sveitarfelog",
        title: "Sveitarfélög",
        institution: "HMS",
        statusElId: "status-sveitarfelog",
        info: "Sveitarfélagamörk úr Landeignaskrá HMS."
      };
      const sveitarfelog = {
        layer: new GraphicsLayer({
          title: sveitarfelogConfig.title,
          visible: false,
          listMode: "hide"
        }),
        config: sveitarfelogConfig
      };
      const onnurVatnsvernd = createLiveBBoxLayer({
        url: "https://gis.ust.is/geoserver/wfs",
        typeName: "OS_vatnsverndarsvaedi_12_2016",
        title: "Vatnsverndarsvæði",
        institution: "Önnur vernd",
        statusElId: "status-onnur-vatnsvernd",
        geometryType: "polygon",
        attributeFields: ["tegund2"],
        info: "Vatnsverndarsvæði úr WFS-þjónustu Umhverfisstofnunar. Flokkað eftir tegund2.",
        legendItems: [
          { color: [151, 185, 229, 0.8], label: "Öryggissvæði" },
          { color: [193, 231, 230, 0.8], label: "Fjarsvæði" },
          { color: [174, 193, 229, 0.8], label: "Grannsvæði" },
          { color: [177, 158, 232, 0.8], label: "Brunnsvæði" }
        ],
        renderer: {
          type: "unique-value",
          field: "tegund2",
          defaultSymbol: {
            type: "simple-fill",
            color: [0, 0, 0, 0],
            outline: { color: [32, 32, 32, 0.9], width: 1 }
          },
          uniqueValueInfos: [
            {
              value: "Öryggissvæði vegna yfirborðsvatns",
              label: "Öryggissvæði",
              symbol: {
                type: "simple-fill",
                color: [151, 185, 229, 0.8],
                outline: { color: [32, 32, 32, 0.9], width: 1 }
              }
            },
            {
              value: "Öryggissvæði vegna grunnvatns",
              label: "Öryggissvæði",
              symbol: {
                type: "simple-fill",
                color: [151, 185, 229, 0.8],
                outline: { color: [32, 32, 32, 0.9], width: 1 }
              }
            },
            {
              value: "Fjarsvæði",
              label: "Fjarsvæði",
              symbol: {
                type: "simple-fill",
                color: [193, 231, 230, 0.8],
                outline: { color: [32, 32, 32, 0.9], width: 1 }
              }
            },
            {
              value: "Grannsvæði",
              label: "Grannsvæði",
              symbol: {
                type: "simple-fill",
                color: [174, 193, 229, 0.8],
                outline: { color: [32, 32, 32, 0.9], width: 1 }
              }
            },
            {
              value: "Brunnsvæði",
              label: "Brunnsvæði",
              symbol: {
                type: "simple-fill",
                color: [177, 158, 232, 0.8],
                outline: { color: [32, 32, 32, 0.9], width: 1 }
              }
            }
          ]
        }
      });
      const hmsWmsLayers = [aaetladEignamork, ornefni, sveitarfelog];

      const stadfangaskra = createLiveBBoxLayer({
        url: "https://gis.fasteignaskra.is/geoserver/wfs",
        typeName: "public:Stadfangaskra",
        title: "Staðfangaskrá",
        institution: "HMS",
        statusElId: "status-stadfangaskra",
        geometryType: "point",
        info: "Staðfangaskrá frá HMS. Inniheldur staðsetningu mannvirkja, heimila, fyrirtækja og annarra áfangastaða. Inniheldur færslur fyrir yfir 95% allra skráðra fasteigna í fasteignaskrá Þjóðskrár Íslands.\n\nHeimild: Húsnæðis-, mannvirkja og skipulagsstofnun",
        renderer: {
          type: "simple",
          symbol: {
            type: "simple-marker",
            style: "circle",
            size: 5,
            color: [156, 39, 176, 0.85],
            outline: { color: [255, 255, 255, 0.9], width: 0.75 }
          }
        }
      });

      const nytjaland = createLiveBBoxLayer({
        url: "https://gis.fasteignaskra.is/geoserver/wfs",
        typeName: "public:Nytjaland 2006",
        title: "Nytjaland",
        institution: "HMS",
        statusElId: "status-nytjaland",
        vectorOnly: true,
        geometryType: "polygon",
        labelField: "HEITI",
        showLabels: true,
        info: "Nytjaland 2006 – Áætlað flatarmál jarða. HMS varðveitir gagnagrunn frá Nytjalandsverkefninu (2006), upphaflega unnið af Landbúnaðarháskóla Íslands o.fl. \n\nAth. flákarnir hafa enga lagalega þýðingu og ber að taka þeim aðeins sem vísbendingu fyrir frekari heimildaöflun. Þinglýst landamerkjabréf jarða má nálgast hjá viðkomandi sýslumannsembætti.\n\nHeimild: Húsnæðis- og mannvirkjastofnun / Nytjalandsverkefnið",
        renderer: {
          type: "simple",
          symbol: {
            type: "simple-fill",
            color: [0, 0, 0, 0],
            outline: { color: [0, 0, 0, 1], width: 1 }
          }
        }
      });

      const skipulagsmork = createLiveBBoxLayer({
        url: "https://luk.skipulag.is/server/services/Stafraent_deiliskipulag/MapServer/WFSServer",
        typeName: "Stafraent_deiliskipulag:Skipulagsmörk",
        outputFormat: "GEOJSON",
        title: "Deiliskipulag",
        institution: "Skipulagsstofnun",
        statusElId: "status-skipulagsmork",
        geometryType: "polygon",
        linkifyUrls: true,
        info: "Skipulagsmörk úr stafrænu deiliskipulagi.\n\nHeimild: Skipulagsstofnun",
        renderer: {
          type: "simple",
          symbol: {
            type: "simple-fill",
            color: [255, 85, 0, 0.5],
            outline: { color: [255, 47, 0, 0.9], width: 0.75 }
          }
        }
      });


      const adalskipulagLayer = new MapImageLayer({
        url: "https://luk.skipulag.is/server/rest/services/Adalskipulag_WM/MapServer",
        title: "Aðalskipulag",
        visible: false,
        opacity: 0.70
      });

      const adalskipulag = {
        layer: adalskipulagLayer,
        config: {
          title: "Aðalskipulag",
          institution: "Skipulagsstofnun",
          statusElId: "status-adalskipulag",
          info: "Aðalskipulag Skipulagsstofnunar"
        }
      };

      const adalskipulagIdentifyLayers = [
        { id: 1, title: "Skipulagsmörk" },
        { id: 4, title: "Önnur ákvæði, punktar" },
        { id: 5, title: "Önnur ákvæði, línur" },
        { id: 8, title: "Önnur ákvæði, flákar" },
        { id: 11, title: "Landnotkun" }
      ].map(function (item) {
        return {
          title: item.title,
          layer: new FeatureLayer({
            url: adalskipulagLayer.url + "/" + item.id,
            outFields: ["*"],
            popupEnabled: false,
            visible: false,
            listMode: "hide"
          })
        };
      });


      const fridlystMinjasvaedi = createLiveBBoxLayer({
        url: "https://ogc.gis.is/geoserver/Minjastofnun/wfs",
        typeName: "Minjastofnun:fridlyst_minjasvaedi",
        title: "Friðlýst minjasvæði",
        institution: "Minjastofnun",
        statusElId: "status-fridlyst-minjasvaedi",
        geometryType: "polygon",
        info: "Staðsetningu og umfang friðlýstra minjasvæða á Íslandi sem Minjastofnun Íslands hefur friðlýst í samræmi við lög nr. 80/2012 um menningarminjar.\n\nHeimild: Minjastofnun Íslands",
        renderer: {
          type: "simple",
          symbol: {
            type: "simple-fill",
            color: [156, 204, 101, 0.4],
            outline: { color: [104, 159, 56, 0.9], width: 0.75 }
          }
        }
      });

      const fornleifaskraning = createLiveBBoxLayer({
        url: "https://ogc.gis.is/geoserver/Minjastofnun/wfs",
        typeName: "Minjastofnun:fornleifaskraning_verkefni",
        title: "Fornleifaskráning",
        institution: "Minjastofnun",
        statusElId: "status-fornleifaskraning",
        geometryType: "polygon",
        labelField: "nafn_verkefnis",
        linkifyUrls: true,
        info: "Svæði þar sem lögbundin fornleifaskráning hefur farið fram vegna aðal-og deiliskipulags, umhverfismats eða vegna framkvæmda. Hér koma fram upplýsingar um skrásetjara, titil skýrslu, tilgang skráningar, aðferðir og nákvæmni landupplýsinganna.\n\nHeimild: Minjastofnun Íslands",
        attributeFields: ["verkefni_lokid"],
        legendItems: [
          { color: [228, 215, 252, 0.9], label: "Verkefni lokið" },
          { color: [252, 199, 184, 0.9], label: "Verkefni í vinnslu" }
        ],
        renderer: {
          type: "unique-value",
          field: "verkefni_lokid",
          symbol: {
            type: "simple-fill",
            color: [141, 110, 99, 0.85],
            outline: { color: [110, 110, 110, 0.9], width: 0.75 }
          },
          defaultSymbol: {
            type: "simple-fill",
            color: [158, 158, 158, 0.35],
            outline: { color: [110, 110, 110, 0.9], width: 0.75 }
          },
          uniqueValueInfos: [
            {
              value: "true",
              label: "Verkefni lokið",
              symbol: {
                type: "simple-fill",
                color: [228, 215, 252, 0.45],
                outline: { color: [178, 119, 178, 0.9], width: 0.30 }
              }
            },
            {
              value: "false",
              label: "Í vinnslu, landupplýsingar ekki á vef",
              symbol: {
                type: "simple-fill",
                color: [252, 199, 184, 0.45],
                outline: { color: [252, 172, 184, 0.9], width: 0.30 }
              }
            }
          ]
        }
      });

      const nattSpecialProtectionConfigs = [
        {
          title: "Söguleg hraun, runnin eftir landnám 871",
          subgroupPath: ["Eldhraun frá nútíma"],
          typeName: "ni:natt_n50v_serstok_vernd_2_n25v_hraun_nutima_fl",
          geometryType: "polygon",
          cqlFilter: "jardsogulegurAldur LIKE 'H_iss'"
        },
        {
          title: "Forsöguleg hraun",
          subgroupPath: ["Eldhraun frá nútíma"],
          typeName: "ni:natt_n50v_serstok_vernd_2_n25v_hraun_nutima_fl",
          geometryType: "polygon",
          cqlFilter: "jardsogulegurAldur LIKE 'H_isfs'"
        },
        {
          title: "Gígur",
          subgroupPath: ["Eldvörp og gervigígar frá nútíma"],
          typeName: "ni:natt_n50v_serstok_vernd_2_n25v_gigar_nutima_li",
          geometryType: "polyline",
          cqlFilter: "gerdGosgig LIKE 'gig'"
        },
        {
          title: "Gjallgígur",
          subgroupPath: ["Eldvörp og gervigígar frá nútíma"],
          typeName: "ni:natt_n50v_serstok_vernd_2_n25v_gigar_nutima_fl",
          geometryType: "polygon",
          cqlFilter: "gerdGosgig LIKE 'gig03'"
        },
        {
          title: "Gígaröð",
          subgroupPath: ["Eldvörp og gervigígar frá nútíma"],
          typeName: "ni:natt_n50v_serstok_vernd_2_n25v_gigar_nutima_li",
          geometryType: "polyline",
          cqlFilter: "gerdGosgig LIKE 'gigr'"
        },
        {
          title: "Gervigígar",
          subgroupPath: ["Eldvörp og gervigígar frá nútíma"],
          typeName: "ni:natt_n50v_serstok_vernd_2_n25v_gigar_nutima_fl",
          geometryType: "polygon",
          cqlFilter: "gerdGosgig LIKE 'gig90'"
        },
        {
          title: "Ker: gjóskufláki",
          subgroupPath: ["Eldvörp og gervigígar frá nútíma", "Ker"],
          typeName: "ni:natt_n50v_serstok_vernd_2_n25v_gigar_nutima_fl",
          geometryType: "polygon",
          cqlFilter: "gerdGosgig LIKE 'gig05'"
        },
        {
          title: "Ker: gígbarmur",
          subgroupPath: ["Eldvörp og gervigígar frá nútíma", "Ker"],
          typeName: "ni:natt_n50v_serstok_vernd_2_n25v_gigar_nutima_li",
          geometryType: "polyline",
          cqlFilter: "gerdGosgig LIKE 'gig05'"
        },
        {
          title: "Gjóskugígur: gjóskufláki",
          subgroupPath: ["Eldvörp og gervigígar frá nútíma", "Gjóskugígur"],
          typeName: "ni:natt_n50v_serstok_vernd_2_n25v_gigar_nutima_fl",
          geometryType: "polygon",
          cqlFilter: "gerdGosgig LIKE 'gig04'"
        },
        {
          title: "Gjóskugígur: gígbarmur",
          subgroupPath: ["Eldvörp og gervigígar frá nútíma", "Gjóskugígur"],
          typeName: "ni:natt_n50v_serstok_vernd_2_n25v_gigar_nutima_li",
          geometryType: "polyline",
          cqlFilter: "gerdGosgig LIKE 'gig04'"
        },
        {
          title: "Dyngjugígur: gígbarmur",
          subgroupPath: ["Eldvörp og gervigígar frá nútíma", "Dyngjugígur"],
          typeName: "ni:natt_n50v_serstok_vernd_2_n25v_gigar_nutima_li",
          geometryType: "polyline",
          cqlFilter: "gerdGosgig LIKE 'gig06'"
        },
        {
          title: "Dyngjugígur: gjóskufláki",
          subgroupPath: ["Eldvörp og gervigígar frá nútíma", "Dyngjugígur"],
          typeName: "ni:natt_n50v_serstok_vernd_2_n25v_gigar_nutima_fl",
          geometryType: "polygon",
          cqlFilter: "gerdGosgig LIKE 'gig06'"
        },
        {
          title: "Háhitasvæði",
          subgroupPath: ["Hverir og aðrar heitar uppsprettur"],
          typeName: "ni:ni_n50v_serstok_vernd_1_n500v_jardhiti_fl",
          geometryType: "polygon"
        },
        {
          title: "Jarðhitagufa",
          subgroupPath: ["Hverir og aðrar heitar uppsprettur"],
          typeName: "ni:ni_n50v_serstok_vernd_1_n500v_jardhiti_p",
          geometryType: "point",
          cqlFilter: "hverirNI LIKE 'gufa'"
        },
        {
          title: "Hver, yfir 70°C",
          subgroupPath: ["Hverir og aðrar heitar uppsprettur"],
          typeName: "ni:ni_n50v_serstok_vernd_1_n500v_jardhiti_p",
          geometryType: "point",
          cqlFilter: "hverirNI LIKE 'hver'"
        },
        {
          title: "Laug, 25 til 70°C",
          subgroupPath: ["Hverir og aðrar heitar uppsprettur"],
          typeName: "ni:ni_n50v_serstok_vernd_1_n500v_jardhiti_p",
          geometryType: "point",
          cqlFilter: "hverirNI LIKE 'laug'"
        },
        {
          title: "Volgra, 10 til 25°C",
          subgroupPath: ["Hverir og aðrar heitar uppsprettur"],
          typeName: "ni:ni_n50v_serstok_vernd_1_n500v_jardhiti_p",
          geometryType: "point",
          cqlFilter: "hverirNI LIKE 'volgra'"
        },
        {
          title: "Kolsýrulaug",
          subgroupPath: ["Hverir og aðrar heitar uppsprettur"],
          typeName: "ni:ni_n50v_serstok_vernd_1_n500v_jardhiti_p",
          geometryType: "point",
          cqlFilter: "hverirNI LIKE 'kolsýrulaugar'"
        },
        {
          title: "Yfirborðshiti í eldstöð",
          subgroupPath: ["Hverir og aðrar heitar uppsprettur"],
          typeName: "ni:ni_n50v_serstok_vernd_1_n500v_jardhiti_p",
          geometryType: "point",
          cqlFilter: "hverirNI LIKE 'hiti í virkum eldstöðvum'"
        },
        {
          title: "Fossar",
          subgroupPath: ["Stöðuvötn, tjarnir og fossar"],
          typeName: "ni:ni_n50v_serstok_vernd_1_n50v_fossar_p",
          geometryType: "point"
        },
        {
          title: "Stöðuvötn og tjarnir 1000 m2 eða stærra",
          subgroupPath: ["Stöðuvötn, tjarnir og fossar"],
          typeName: "ni:ni_n50v_serstok_vernd_1_n50v_votn_fl",
          geometryType: "polygon"
        },
        {
          title: "Hellasvæði",
          subgroupPath: ["Hraunhellar frá nútíma"],
          typeName: "ni:ni_n50v_serstok_vernd_1_n100v_hellasvaedi_fl",
          geometryType: "polygon"
        },
        {
          title: "Hellar með þjónustu",
          subgroupPath: ["Hraunhellar frá nútíma"],
          typeName: "ni:ni_n50v_serstok_vernd_1_n25v_hellar_leidsogn_p",
          geometryType: "point"
        },
        {
          title: "Leirur",
          subgroupPath: ["Sjávarfitjar og leirur"],
          typeName: "ni:ni_n50v_serstok_vernd_1_n25v_leirur_fl",
          geometryType: "polygon"
        },
        {
          title: "Sjávarfitjar",
          subgroupPath: ["Sjávarfitjar og leirur"],
          typeName: "ni:ni_n50v_serstok_vernd_1_n25v_sjavarfitjar_fl",
          geometryType: "polygon"
        },
        {
          title: "Lítt raskað votlendi stærra en 20.000 m2; meira en 200 m frá skurðum á láglendi",
          subgroupPath: ["Votlendi"],
          typeName: "ni:ni_n50v_serstok_vernd_1_n25v_votlendi_litt_raskad_fl",
          geometryType: "polygon"
        },
        {
          title: "Votlendi stærra en 20.000 m2",
          subgroupPath: ["Votlendi"],
          typeName: "ni:ni_n50v_serstok_vernd_1_n35v_votlendi_fl",
          geometryType: "polygon"
        }
      ];

      const nattSpecialProtectionLayers = nattSpecialProtectionConfigs.map(function (config, index) {
        const symbol = config.geometryType === "point"
          ? {
            type: "simple-marker",
            style: "circle",
            size: 6,
            color: [230, 81, 0, 0.9],
            outline: { color: [255, 255, 255, 0.9], width: 0.75 }
          }
          : (config.geometryType === "polyline"
            ? { type: "simple-line", color: [230, 81, 0, 0.9], width: 2 }
            : {
              type: "simple-fill",
              color: [255, 152, 0, 0.35],
              outline: { color: [230, 81, 0, 0.9], width: 0.75 }
            });

        const layerConfig = Object.assign({
          url: "https://gis.natt.is/geoserver/wfs",
          institution: "Náttúrufræðistofnun",
          statusElId: "status-natt-special-protection-" + (index + 1),
          info: "Sérstök vernd náttúrufyrirbæra samkvæmt 61. gr. náttúruverndarlaga.\n\nHeimild: Náttúrufræðistofnun Íslands.",
          renderer: { type: "simple", symbol: symbol }
        }, config);
        layerConfig.subgroupPath = [
          "Sérstök vernd náttúrufyrirbæra (61. gr.)"
        ].concat(config.subgroupPath);
        return createLiveBBoxLayer(layerConfig);
      });

      const nattRegistryConfigs = [
        {
          title: "Vistgerðir, fuglar og selir",
          typeName: "ni:ni_tillogur_ad_svaedum_a_b_hluta_natturuminjaskrar",
          cqlFilter: "nitillagafyrir LIKE 'vistgerðir, fugla og selir'",
          subgroupPath: ["Náttúruminjaskrá", "Tillögur að svæðum á B-hluta náttúruminjaskrár", "Vistgerðir, fuglar og selir"],
          source: "Náttúrufræðistofnun"
        },
        {
          title: "Undirvæði vistgerða og fugla",
          typeName: "ni:ni_tillogur_ad_svaedum_a_b_hluta_natturuminjaskrar",
          cqlFilter: "nitillagafyrir LIKE 'undirsvæði vistgerða og fugla'",
          subgroupPath: ["Náttúruminjaskrá", "Tillögur að svæðum á B-hluta náttúruminjaskrár", "Vistgerðir, fuglar og selir"],
          source: "Náttúrufræðistofnun"
        },
        {
          title: "Jarðminjar",
          typeName: "ni:ni_tillogur_ad_svaedum_a_b_hluta_natturuminjaskrar",
          cqlFilter: "nitillagafyrir LIKE 'jarðminjar'",
          subgroupPath: ["Náttúruminjaskrá", "Tillögur að svæðum á B-hluta náttúruminjaskrár", "Jarðminjar"],
          source: "Náttúrufræðistofnun"
        },
        {
          title: "Fossasvæði",
          typeName: "ni:ni_tillogur_ad_svaedum_a_b_hluta_natturuminjaskrar",
          cqlFilter: "nitillagafyrir LIKE 'fossasvæði'",
          subgroupPath: ["Náttúruminjaskrá", "Tillögur að svæðum á B-hluta náttúruminjaskrár", "Jarðminjar"],
          source: "Náttúrufræðistofnun"
        },
        {
          title: "Aðrar náttúruminjar (C-hluti)",
          typeName: "fridlyst_svaedi:natturuminjaskra",
          url: "https://gis.ust.is/geoserver/wfs",
          subgroupPath: ["Náttúruminjaskrá"],
          source: "Náttúruverndarstofnun"
        },
        {
          title: "Þjóðgarðar",
          typeName: "fridlyst_svaedi:fridlyst_svaedi",
          url: "https://gis.ust.is/geoserver/wfs",
          cqlFilter: "odesignate = 'Þjóðgarður'",
          subgroupPath: ["Friðlýst svæði"],
          source: "Náttúruverndarstofnun"
        },
        {
          title: "Friðland",
          typeName: "fridlyst_svaedi:fridlyst_svaedi",
          url: "https://gis.ust.is/geoserver/wfs",
          cqlFilter: "odesignate = 'Friðland'",
          subgroupPath: ["Friðlýst svæði"],
          source: "Náttúruverndarstofnun"
        },
        {
          title: "Náttúruvætti",
          typeName: "fridlyst_svaedi:fridlyst_svaedi",
          url: "https://gis.ust.is/geoserver/wfs",
          cqlFilter: "odesignate = 'Náttúruvætti'",
          subgroupPath: ["Friðlýst svæði"],
          source: "Náttúruverndarstofnun"
        },
        {
          title: "Fólkvangur",
          typeName: "fridlyst_svaedi:fridlyst_svaedi",
          url: "https://gis.ust.is/geoserver/wfs",
          cqlFilter: "odesignate = 'Fólkvangur'",
          subgroupPath: ["Friðlýst svæði"],
          source: "Náttúruverndarstofnun"
        },
        {
          title: "Búsvæði",
          typeName: "fridlyst_svaedi:fridlyst_svaedi",
          url: "https://gis.ust.is/geoserver/wfs",
          cqlFilter: "odesignate = 'Búsvæði'",
          subgroupPath: ["Friðlýst svæði"],
          source: "Náttúruverndarstofnun"
        },
        {
          title: "Landslagsverndarsvæði",
          typeName: "fridlyst_svaedi:fridlyst_svaedi",
          url: "https://gis.ust.is/geoserver/wfs",
          cqlFilter: "odesignate = 'Landslagsverndarsvæði'",
          subgroupPath: ["Friðlýst svæði"],
          source: "Náttúruverndarstofnun"
        },
        {
          title: "Óbyggð víðerni",
          typeName: "fridlyst_svaedi:fridlyst_svaedi",
          url: "https://gis.ust.is/geoserver/wfs",
          cqlFilter: "odesignate = 'Óbyggð víðerni'",
          subgroupPath: ["Friðlýst svæði"],
          source: "Náttúruverndarstofnun"
        },
        {
          title: "Jaðarsvæði",
          typeName: "fridlyst_svaedi:fridlyst_svaedi",
          url: "https://gis.ust.is/geoserver/wfs",
          cqlFilter: "odesignate = 'Jaðarsvæði'",
          subgroupPath: ["Friðlýst svæði"],
          source: "Náttúruverndarstofnun"
        },
        {
          title: "Önnur friðlýst svæði",
          typeName: "fridlyst_svaedi:fridlyst_svaedi",
          url: "https://gis.ust.is/geoserver/wfs",
          cqlFilter: "odesignate = 'Önnur friðlýst svæði'",
          subgroupPath: ["Friðlýst svæði"],
          source: "Náttúruverndarstofnun"
        }
      ];

      const nattRegistryLayers = nattRegistryConfigs.map(function (config, index) {
        const isProtectedArea = config.subgroupPath[0] === "Friðlýst svæði";
        const isCPart = config.title === "Aðrar náttúruminjar (C-hluti)";
        const color = isProtectedArea ? [76, 175, 80] : (isCPart ? [156, 39, 176] : [255, 152, 0]);
        const outlineColor = isProtectedArea ? [46, 125, 50] : (isCPart ? [123, 31, 162] : [230, 81, 0]);

        return createLiveBBoxLayer(Object.assign({
          url: "https://gis.natt.is/geoserver/wfs",
          institution: "Náttúrufræðistofnun",
          statusElId: "status-natt-registry-" + (index + 1),
          geometryType: "polygon",
          subgroupPath: config.subgroupPath,
          info: config.title + " úr " + config.source + ".\n\nHeimild: " + config.source + ".",
          renderer: {
            type: "simple",
            symbol: {
              type: "simple-fill",
              color: color.concat([0.35]),
              outline: { color: outlineColor.concat([0.9]), width: 0.75 }
            }
          }
        }, config));
      });

      const allLiveLayers = [fridlyst, vatnsvernd, thjodlendur, landeignaskra, stadfangaskra, nytjaland, onnurVatnsvernd, fridlystMinjasvaedi, fornleifaskraning, skipulagsmork]
        .concat(nattSpecialProtectionLayers)
        .concat(nattRegistryLayers);

      map.addMany(allLiveLayers
        .filter(function (l) { return l !== landeignaskra; })
        .map(function (l) { return l.layer; }));
      map.addMany(hmsWmsLayers.map(function (l) { return l.layer; }));
      map.add(adalskipulagLayer);

      function createHmsImageOverlay(layerObject, config) {
        if (config.vectorOnly) return null;

        const image = document.createElement("img");
        image.alt = "";
        image.setAttribute("aria-hidden", "true");
        image.style.cssText =
          "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;" +
          "object-fit:fill;display:none;z-index:1;";
        let refreshTimer = null;
        let requestId = 0;

        function refreshImage() {
          if (!layerObject.layer.visible) {
            image.style.display = "none";
            return;
          }
          if (!view.stationary || !view.extent || view.width < 1 || view.height < 1) return;

          const currentRequestId = ++requestId;
          const params = new URLSearchParams(Object.assign({
            BBOX: [
              view.extent.xmin,
              view.extent.ymin,
              view.extent.xmax,
              view.extent.ymax
            ].join(","),
            HEIGHT: String(Math.round(view.height)),
            WIDTH: String(Math.round(view.width))
          }, config.imageParams || {}));
          const statusEl = document.getElementById(config.statusElId);
          const nextImage = new Image();
          nextImage.onload = function () {
            if (currentRequestId !== requestId || !layerObject.layer.visible) return;
            image.src = nextImage.src;
            image.style.display = "block";
            if (statusEl) {
              statusEl.className = "layerRowStatus ok";
              statusEl.textContent = "✅ mynd hlaðin";
            }
          };
          nextImage.onerror = function () {
            if (currentRequestId !== requestId) return;
            console.error("Gat ekki sótt mynd fyrir " + config.title);
            if (statusEl) {
              statusEl.className = "layerRowStatus fail";
              statusEl.textContent = "❌ ekki tókst að sækja mynd";
            }
          };
          if (!config.retainPreviousImage || !image.src) image.style.display = "none";
          nextImage.src = config.imageUrl + "?" + params.toString();
        }

        function scheduleRefresh() {
          clearTimeout(refreshTimer);
          if (!layerObject.layer.visible) {
            requestId++;
            image.style.display = "none";
            return;
          }
          if (!view.stationary) {
            requestId++;
            if (!config.retainPreviousImage) image.style.display = "none";
            return;
          }
          refreshTimer = setTimeout(refreshImage, 120);
        }

        layerObject.layer.watch("visible", scheduleRefresh);
        view.watch("extent", scheduleRefresh);
        view.watch("size", scheduleRefresh);
        view.watch("stationary", function (stationary) {
          if (stationary) scheduleRefresh();
          else {
            requestId++;
            if (!config.retainPreviousImage) image.style.display = "none";
          }
        });
        view.when(function () {
          const viewRoot = view.container.querySelector(".esri-view-root") || view.container;
          const overlaySurface = viewRoot.querySelector(".esri-overlay-surface");
          if (overlaySurface) {
            overlaySurface.parentNode.insertBefore(image, overlaySurface);
          } else {
            viewRoot.appendChild(image);
          }
          scheduleRefresh();
        });
        return image;
      }

      createHmsImageOverlay(landeignaskra, landeignaskraConfig);
      createHmsImageOverlay(nytjaland, nytjaland.config);
      createHmsImageOverlay(ornefni, ornefniConfig);
      createHmsImageOverlay(sveitarfelog, sveitarfelogConfig);

      const aaetladEignamorkImage = document.createElement("img");
      aaetladEignamorkImage.alt = "";
      aaetladEignamorkImage.setAttribute("aria-hidden", "true");
      aaetladEignamorkImage.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;" +
        "object-fit:fill;mix-blend-mode:multiply;display:none;z-index:1;";
      let aaetladEignamorkRefreshTimer = null;
      let aaetladEignamorkRequestId = 0;
      function refreshAaetladEignamorkImage() {
        if (!aaetladEignamork.layer.visible) {
          aaetladEignamorkImage.style.display = "none";
          return;
        }
        if (!view.stationary || !view.extent || view.width < 1 || view.height < 1) return;

        const requestId = ++aaetladEignamorkRequestId;
        const params = new URLSearchParams({
          BBOX: [
            view.extent.xmin,
            view.extent.ymin,
            view.extent.xmax,
            view.extent.ymax
          ].join(","),
          HEIGHT: String(Math.round(view.height)),
          WIDTH: String(Math.round(view.width))
        });
        const imageUrl = aaetladEignamorkConfig.url + "?" + params.toString();

        aaetladEignamorkImage.onload = function () {
          if (requestId === aaetladEignamorkRequestId &&
            aaetladEignamork.layer.visible) {
            aaetladEignamorkImage.style.display = "block";
            const statusEl = document.getElementById(aaetladEignamorkConfig.statusElId);
            if (statusEl) {
              statusEl.className = "layerRowStatus ok";
              statusEl.textContent = "✅ mynd hlaðin";
            }
          }
        };
        aaetladEignamorkImage.onerror = function () {
          if (requestId !== aaetladEignamorkRequestId) return;
          aaetladEignamorkImage.style.display = "none";
          console.error("Gat ekki sótt mynd fyrir " + aaetladEignamorkConfig.title, imageUrl);
          const statusEl = document.getElementById(aaetladEignamorkConfig.statusElId);
          if (statusEl) {
            statusEl.className = "layerRowStatus fail";
            statusEl.textContent = "❌ ekki tókst að sækja mynd";
          }
        };
        aaetladEignamorkImage.style.display = "none";
        aaetladEignamorkImage.src = imageUrl;
      }

      function scheduleAaetladEignamorkRefresh() {
        clearTimeout(aaetladEignamorkRefreshTimer);
        if (!aaetladEignamork.layer.visible) {
          aaetladEignamorkImage.style.display = "none";
          return;
        }
        if (!view.stationary) {
          aaetladEignamorkImage.style.display = "none";
          return;
        }
        aaetladEignamorkRefreshTimer = setTimeout(refreshAaetladEignamorkImage, 120);
      }

      aaetladEignamork.layer.watch("visible", scheduleAaetladEignamorkRefresh);
      view.watch("extent", scheduleAaetladEignamorkRefresh);
      view.watch("size", scheduleAaetladEignamorkRefresh);
      view.watch("stationary", function (stationary) {
        if (stationary) scheduleAaetladEignamorkRefresh();
        else aaetladEignamorkImage.style.display = "none";
      });
      view.when(function () {
        const viewRoot = view.container.querySelector(".esri-view-root") || view.container;
        const overlaySurface = viewRoot.querySelector(".esri-overlay-surface");
        if (overlaySurface) {
          overlaySurface.parentNode.insertBefore(aaetladEignamorkImage, overlaySurface);
        } else {
          viewRoot.appendChild(aaetladEignamorkImage);
        }
        scheduleAaetladEignamorkRefresh();
      });

      // ---------------------------------------------------------
      // UPPLÝSINGABÚBBLA
      // ---------------------------------------------------------
      const infoModalOverlay = document.getElementById("infoModalOverlay");
      const infoModalTitle = document.getElementById("infoModalTitle");
      const infoModalBody = document.getElementById("infoModalBody");

      function openInfoModal(title, text) {
        infoModalTitle.textContent = title;
        infoModalBody.textContent = text || "Engar upplýsingar skráðar fyrir þetta lag ennþá.";
        infoModalOverlay.style.display = "flex";
      }

      function closeInfoModal() {
        infoModalOverlay.style.display = "none";
      }

      document.getElementById("infoModalClose").addEventListener("click", closeInfoModal);
      infoModalOverlay.addEventListener("click", function (e) {
        if (e.target === infoModalOverlay) closeInfoModal();
      });

      const layerListEl = document.getElementById("layerList");
      const institutionOrder = [
        "Rarik",
        "Vegagerðin",
        "Skipulagsstofnun",
        "HMS",
        "Önnur vernd",
        "Minjastofnun",
        "Vatnshlot",
        "Náttúrufræðistofnun",
        "Náttúruverndarstofnun"
      ];

      // Tri-state registries. Declared once, before they are used.
      const institutionBodies = {};
      const institutionHeaders = {};
      const institutionCheckboxes = {};
      const institutionLayers = {};
      const subgroupBodies = {};
      const subgroupHeaders = {};
      const subgroupCheckboxes = {};
      const subgroupLayers = {};

      function getLayerSubgroupPath(layerObject) {
        if (Array.isArray(layerObject.config.subgroupPath)) {
          return layerObject.config.subgroupPath;
        }
        return layerObject.config.subgroup ? [layerObject.config.subgroup] : [];
      }

      function getSubgroupKey(institutionName, subgroupPath) {
        return JSON.stringify([institutionName].concat(subgroupPath));
      }

      const everyLayer =
        allLiveLayers
          .concat(hmsWmsLayers)
          .concat(arcgisFeatureLayers)
          .concat([adalskipulag])
      everyLayer.forEach(function (l) {
        const institution = l.config.institution || "Rarik";
        if (!institutionLayers[institution]) institutionLayers[institution] = [];
        institutionLayers[institution].push(l);

        const subgroupPath = getLayerSubgroupPath(l);
        subgroupPath.forEach(function (_label, index) {
          const subgroupKey = getSubgroupKey(institution, subgroupPath.slice(0, index + 1));
          if (!subgroupLayers[subgroupKey]) subgroupLayers[subgroupKey] = [];
          subgroupLayers[subgroupKey].push(l);
        });
      });

      function updateTriState(checkbox, layers) {
        if (!checkbox) return;
        const total = layers ? layers.length : 0;
        const visible = total ? layers.filter(function (l) { return l.layer.visible; }).length : 0;
        checkbox.indeterminate = visible > 0 && visible < total;
        checkbox.checked = total > 0 && visible === total;
        checkbox.disabled = total === 0;
      }

      function refreshAllTriStates() {
        Object.keys(subgroupCheckboxes).forEach(function (label) {
          updateTriState(subgroupCheckboxes[label], subgroupLayers[label] || []);
        });
        Object.keys(institutionCheckboxes).forEach(function (name) {
          updateTriState(institutionCheckboxes[name], institutionLayers[name] || []);
        });
      }

      function setLayerVisibility(layerObject, visible) {
        layerObject.layer.visible = visible;
        if (layerObject.uiCheckbox) layerObject.uiCheckbox.checked = visible;
        if (visible && layerObject.refreshForExtent && view.extent) {
          layerObject.refreshForExtent(view.extent);
        }
      }

      function setGroupVisibility(layers, visible) {
        (layers || []).forEach(function (l) {
          setLayerVisibility(l, visible);
        });
        refreshAllTriStates();
      }

      institutionOrder.forEach(function (name) {
        const group = document.createElement("div");
        group.className = "institutionGroup";

        const header = document.createElement("div");
        header.className = "institutionHeader";
        header.innerHTML =
          '<input type="checkbox" class="institutionCheckbox" aria-label="Velja allar þekjur fyrir ' + name + '">' +
          '<span class="institutionCaret">▸</span>' +
          '<span class="institutionTitle">' + name + '</span>';

        const body = document.createElement("div");
        body.className = "institutionBody";

        const checkbox = header.querySelector(".institutionCheckbox");
        const caret = header.querySelector(".institutionCaret");

        checkbox.addEventListener("click", function (e) { e.stopPropagation(); });
        checkbox.addEventListener("change", function () {
          setGroupVisibility(institutionLayers[name] || [], checkbox.checked);
          if (checkbox.checked) {
            body.classList.add("open");
            caret.textContent = "▾";
          }
        });

        header.addEventListener("click", function () {
          body.classList.toggle("open");
          caret.textContent = body.classList.contains("open") ? "▾" : "▸";
        });

        group.appendChild(header);
        group.appendChild(body);
        layerListEl.appendChild(group);
        institutionBodies[name] = body;
        institutionHeaders[name] = header;
        institutionCheckboxes[name] = checkbox;
      });

      function attachLayerCheckbox(layerObject, checkbox) {
        layerObject.uiCheckbox = checkbox;
        checkbox.checked = !!layerObject.layer.visible;
        checkbox.addEventListener("change", function () {
          setLayerVisibility(layerObject, checkbox.checked);
          refreshAllTriStates();
        });
      }

      // External map and WFS layers.
      allLiveLayers.concat(hmsWmsLayers).forEach(function (l) {
        const symbol = l.config.renderer?.symbol;

        const c = symbol?.color || [0, 150, 136, 1];

        const swatchColor = "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + c[3] + ")";

        const isPoint = symbol?.type === "simple-marker";
        const isLine = symbol?.type === "simple-line";
        const swatchClass = isPoint
          ? "swatch swatch-point"
          : (isLine ? "swatch swatch-line" : "swatch");
        const hasLegendItems = l.config.legendItems && l.config.legendItems.length;
        const row = document.createElement("label");
        row.className = "layerRow";
        row.innerHTML =
          '<input type="checkbox">' +
          (hasLegendItems ? '' : '<span class="' + swatchClass + '" style="background:' + swatchColor + '"></span>') +
          '<span class="layerRowText">' +
          '<span class="layerRowTitle">' + l.config.title + '</span>' +
          '<span class="layerRowStatus pending" id="' + l.config.statusElId + '">⏳ hleð...</span>' +
          '</span>' +
          (hasLegendItems ? '<span class="layerCaret">▸</span>' : '') +
          '<span class="infoBubble" title="Upplýsingar um lagið">i</span>';

        attachLayerCheckbox(l, row.querySelector('input[type="checkbox"]'));

        row.querySelector(".infoBubble").addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          openInfoModal(l.config.title, l.config.info);
        });

        const subgroupPath = getLayerSubgroupPath(l);
        const targetBody = subgroupPath.length
          ? getOrCreateSubgroupBody(subgroupPath, l.config.institution)
          : (institutionBodies[l.config.institution] || institutionBodies["Rarik"]);
        targetBody.appendChild(row);

        if (!l.refreshForExtent) {
          l.layer.when(function () {
            const el = document.getElementById(l.config.statusElId);
            el.className = "layerRowStatus ok";
            el.textContent = "✅ hlóðst inn";
          }, function (err) {
            const el = document.getElementById(l.config.statusElId);
            el.className = "layerRowStatus fail";
            el.textContent = "❌ villa: " + (err && err.message ? err.message : "óþekkt");
          });
        }

        if (hasLegendItems) {
          const subLegend = document.createElement("div");
          subLegend.className = "layerSubLegend";
          l.config.legendItems.forEach(function (item) {
            const ic = item.color;
            const itemEl = document.createElement("div");
            itemEl.className = "layerSubLegendItem";
            const swatchStyle = l.config.geometryType === "polyline"
              ? "width:18px;height:0;border:0;border-top:2px " + (l.config.legendLineStyle === "dash" ? "dashed" : "solid") + " rgba(" + ic[0] + "," + ic[1] + "," + ic[2] + "," + ic[3] + ");border-radius:0;"
              : "background:rgba(" + ic[0] + "," + ic[1] + "," + ic[2] + "," + ic[3] + ")";
            itemEl.innerHTML =
              '<span class="layerSubLegendSwatch" style="' + swatchStyle + '"></span>' +
              '<span>' + item.label + '</span>';
            subLegend.appendChild(itemEl);
          });
          targetBody.appendChild(subLegend);
          const layerCaret = row.querySelector(".layerCaret");
          layerCaret.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            subLegend.classList.toggle("open");
            layerCaret.textContent = subLegend.classList.contains("open") ? "▾" : "▸";
          });
        }
      });



      (function () {

        const row = document.createElement("label");

        row.className = "layerRow";

        row.innerHTML =
          '<input type="checkbox">' +
          '<span class="swatch" style="background:#009688"></span>' +
          '<span class="layerRowText">' +
          '<span class="layerRowTitle">Aðalskipulag</span>' +
          '<span class="layerRowStatus ok">✅ tiltækt</span>' +
          '</span>' +
          '<span class="infoBubble">i</span>';

        const checkbox =
          row.querySelector('input');

        checkbox.addEventListener(
          "change",
          function () {
            adalskipulagLayer.visible =
              checkbox.checked;
          }
        );

        row.querySelector(".infoBubble")
          .addEventListener("click", function (e) {

            e.preventDefault();
            e.stopPropagation();

            openInfoModal(
              "Aðalskipulag",
              "Aðalskipulag frá Skipulagsstofnun"
            );
          });

        institutionBodies["Skipulagsstofnun"]
          .appendChild(row);

      })();

      function getOrCreateSubgroupBody(subgroupPath, institutionName) {
        let parentBody = institutionBodies[institutionName] || institutionBodies["Rarik"];
        const currentPath = [];

        subgroupPath.forEach(function (subgroupLabel) {
          currentPath.push(subgroupLabel);
          const subgroupKey = getSubgroupKey(institutionName, currentPath);
          if (subgroupBodies[subgroupKey]) {
            parentBody = subgroupBodies[subgroupKey];
            return;
          }

          const header = document.createElement("div");
          header.className = "subgroupHeader";
          header.innerHTML =
            '<input type="checkbox" class="subgroupCheckbox" aria-label="Velja allar þekjur í ' + subgroupLabel + '">' +
            '<span class="subgroupCaret">▸</span>' +
            '<span>' + subgroupLabel + '</span>';

          const body = document.createElement("div");
          body.className = "subgroupBody";
          const checkbox = header.querySelector(".subgroupCheckbox");
          const caret = header.querySelector(".subgroupCaret");

          checkbox.addEventListener("click", function (e) { e.stopPropagation(); });
          checkbox.addEventListener("change", function () {
            setGroupVisibility(subgroupLayers[subgroupKey] || [], checkbox.checked);
            if (checkbox.checked) {
              body.classList.add("open");
              caret.textContent = "▾";
            }
          });

          header.addEventListener("click", function () {
            body.classList.toggle("open");
            caret.textContent = body.classList.contains("open") ? "▾" : "▸";
          });

          parentBody.appendChild(header);
          parentBody.appendChild(body);
          subgroupBodies[subgroupKey] = body;
          subgroupHeaders[subgroupKey] = header;
          subgroupCheckboxes[subgroupKey] = checkbox;
          parentBody = body;
        });

        return parentBody;
      }

      // RARIK ArcGIS Feature Service layers.
      arcgisFeatureLayers.forEach(function (l) {
        const hasLegendItems = l.config.legendItems && l.config.legendItems.length;
        const symbol = (l.layer.renderer && l.layer.renderer.symbol) ||
          (l.config.renderer && l.config.renderer.symbol);
        const isLine = (symbol && symbol.type === "simple-line") ||
          l.config.geometryType === "polyline";
        const isPoint = (symbol && symbol.type === "simple-marker") ||
          l.config.geometryType === "point";
        const swatchColor = (symbol && symbol.color && typeof symbol.color.toCss === "function")
          ? symbol.color.toCss(true)
          : "rgba(230,81,0,1)";
        const row = document.createElement("label");
        row.className = "layerRow";
        row.innerHTML =
          '<input type="checkbox">' +
          (hasLegendItems ? '' : '<span class="swatch' + (isLine ? ' swatch-line' : (isPoint ? ' swatch-point' : '')) + '" style="background:' + swatchColor + '"></span>') +
          '<span class="layerRowText">' +
          '<span class="layerRowTitle">' + l.config.title + '</span>' +
          '<span class="layerRowStatus pending" id="' + l.config.statusElId + '">⏳ hleð...</span>' +
          '</span>' +
          (hasLegendItems ? '<span class="layerCaret">▸</span>' : '') +
          '<span class="infoBubble" title="Upplýsingar um lagið">i</span>';

        attachLayerCheckbox(l, row.querySelector('input[type="checkbox"]'));
        row.querySelector(".infoBubble").addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          openInfoModal(l.config.title, l.config.info);
        });

        const subgroupPath = getLayerSubgroupPath(l);
        const targetBody = subgroupPath.length
          ? getOrCreateSubgroupBody(subgroupPath, l.config.institution)
          : (institutionBodies[l.config.institution] || institutionBodies["Rarik"]);
        targetBody.appendChild(row);

        if (hasLegendItems) {
          const subLegend = document.createElement("div");
          subLegend.className = "layerSubLegend";
          l.config.legendItems.forEach(function (item) {
            const ic = item.color;
            const itemEl = document.createElement("div");
            itemEl.className = "layerSubLegendItem";
            const swatchStyle = l.config.geometryType === "polyline"
              ? "width:18px;height:0;border:0;border-top:2px " + (l.config.legendLineStyle === "dash" ? "dashed" : "solid") + " rgba(" + ic[0] + "," + ic[1] + "," + ic[2] + "," + ic[3] + ");border-radius:0;"
              : "background:rgba(" + ic[0] + "," + ic[1] + "," + ic[2] + "," + ic[3] + ")";
            itemEl.innerHTML =
              '<span class="layerSubLegendSwatch" style="' + swatchStyle + '"></span>' +
              '<span>' + item.label + '</span>';
            subLegend.appendChild(itemEl);
          });
          targetBody.appendChild(subLegend);
          const layerCaret = row.querySelector(".layerCaret");
          layerCaret.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            subLegend.classList.toggle("open");
            layerCaret.textContent = subLegend.classList.contains("open") ? "▾" : "▸";
          });
        }

        l.layer.when(function () {
          const el = document.getElementById(l.config.statusElId);
          el.className = "layerRowStatus ok";
          el.textContent = "✅ hlóðst inn";
        }, function (err) {
          const el = document.getElementById(l.config.statusElId);
          el.className = "layerRowStatus fail";
          el.textContent = "❌ villa: " + (err && err.message ? err.message : "óþekkt");
        });
      });

      institutionOrder.forEach(function (name) {
        if ((institutionLayers[name] || []).length === 0) {
          const empty = document.createElement("div");
          empty.className = "institutionEmpty";
          empty.textContent = "Engar þekjur ennþá";
          institutionBodies[name].appendChild(empty);
        }
      });

      refreshAllTriStates();

      function refreshVisibleLayers(extent) {
        allLiveLayers.forEach(function (l) {
          if (l.layer.visible && l.refreshForExtent) l.refreshForExtent(extent);
        });
      }

      view.when(function () {
        refreshVisibleLayers(view.extent);
      });

      let stationaryHandle = view.watch("stationary", function (isStationary) {
        if (isStationary && view.extent) {
          refreshVisibleLayers(view.extent);
        }
      });

      const attrPanel = document.getElementById("attrPanel");
      const attrPanelTitle = document.getElementById("attrPanelTitle");
      const attrPanelBody = document.getElementById("attrPanelBody");
      document.getElementById("attrPanelClose").addEventListener("click", function () {
        attrPanel.style.display = "none";
      });

      const HIDDEN_FIELDS = ["OBJECTID", "Shape__Area", "Shape__Length", "FID"];

      function buildAttributeTable(attributes, valueMaps, fieldAliases, linkifyUrls) {
        valueMaps = valueMaps || {};
        fieldAliases = fieldAliases || {};
        let rows = "";
        Object.keys(attributes).forEach(function (key) {
          if (HIDDEN_FIELDS.indexOf(key) !== -1) return;
          let value = attributes[key];

          if (valueMaps[key] && value !== null && value !== undefined) {
            const mapped = valueMaps[key][String(value)];
            if (mapped !== undefined) value = mapped;
          }

          let renderedValue = escapeHtml(
            value === null || value === undefined ? "-" : String(value)
          );
          if (linkifyUrls && typeof value === "string") {
            const urlValue = value.trim();
            if (/^https?:\/\/\S+$/i.test(urlValue)) {
              const url = new URL(urlValue);
              if (url.protocol === "http:" || url.protocol === "https:") {
                renderedValue = '<a href="' + escapeHtml(url.href) +
                  '" target="_blank" rel="noopener noreferrer">' +
                  escapeHtml(urlValue) + "</a>";
              }
            }
          }

          rows += "<tr><td>" + escapeHtml(fieldAliases[key] || key) + "</td><td>" +
            renderedValue + "</td></tr>";
        });
        return "<table>" + rows + "</table>";
      }

      function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, function (c) {
          return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
      }

      // ---------------------------------------------------------
      // HIGHLIGHT-LAG - sér GraphicsLayer ofan á allt annað.
      // Óháð OBJECTID-um í upprunalögunum (sem breytast við
      // hverja endurhleðslu), svo highlight virkar alltaf áreiðanlega.
      // ---------------------------------------------------------
      const highlightLayer = new GraphicsLayer({ title: "Valið fyrirbæri", listMode: "hide" });
      map.add(highlightLayer);

      function makeHighlightSymbol(geometryType) {
        if (geometryType === "point") {
          return {
            type: "simple-marker",
            style: "circle",
            size: 18,
            color: [255, 255, 0, 0],
            outline: { color: [255, 193, 7, 1], width: 3 }
          };
        }
        if (geometryType === "polyline") {
          return {
            type: "simple-line",
            color: [255, 193, 7, 1],
            width: 4
          };
        }
        return {
          type: "simple-fill",
          color: [255, 235, 59, 0.25],
          outline: { color: [255, 193, 7, 1], width: 3 }
        };
      }

      function highlightFeature(layer, graphic) {
        clearHighlight();
        if (!graphic || !graphic.geometry) return;
        const highlightGraphic = new Graphic({
          geometry: graphic.geometry,
          symbol: makeHighlightSymbol(graphic.geometry.type)
        });
        highlightLayer.add(highlightGraphic);
      }

      function clearHighlight() {
        highlightLayer.removeAll();
      }

      async function identifyAaetladEignamork(mapPoint) {
        const tolerance = Math.max(view.resolution * 6, 1);
        const minX = mapPoint.x - tolerance;
        const minY = mapPoint.y - tolerance;
        const maxX = mapPoint.x + tolerance;
        const maxY = mapPoint.y + tolerance;
        const callbackName = "__aaetladEignamork_" + Date.now() + "_" +
          Math.floor(Math.random() * 1000000);
        const params = new URLSearchParams({
          service: "WFS",
          version: "1.1.0",
          request: "GetFeature",
          typename: aaetladEignamorkConfig.typeName,
          outputFormat: "text/javascript",
          srsname: "EPSG:3057",
          bbox: [minX, minY, maxX, maxY, "EPSG:3057"].join(","),
          maxFeatures: "25",
          format_options: "callback:" + callbackName
        });
        const url = aaetladEignamorkConfig.identifyUrl + "?" + params.toString();
        const featureCollection = await new Promise(function (resolve, reject) {
          const script = document.createElement("script");
          const timeout = setTimeout(function () {
            cleanup();
            reject(new Error("Tímamörk við að sækja áætluð eignamörk."));
          }, 15000);

          function cleanup() {
            clearTimeout(timeout);
            script.remove();
            delete window[callbackName];
          }

          window[callbackName] = function (data) {
            cleanup();
            resolve(data);
          };
          script.onerror = function () {
            cleanup();
            reject(new Error("WFS þjónustan skilaði ekki eignamörkum."));
          };
          script.src = url;
          document.head.appendChild(script);
        });

        const features = featureCollection && featureCollection.features || [];
        for (let i = 0; i < features.length; i++) {
          const feature = features[i];
          if (!feature.geometry) continue;

          let polygons;
          if (feature.geometry.type === "Polygon") {
            polygons = [feature.geometry.coordinates];
          } else if (feature.geometry.type === "MultiPolygon") {
            polygons = feature.geometry.coordinates;
          } else {
            continue;
          }

          for (let j = 0; j < polygons.length; j++) {
            const graphic = new Graphic({
              geometry: {
                type: "polygon",
                rings: polygons[j],
                spatialReference: { wkid: 3057 }
              },
              attributes: feature.properties || {}
            });
            if (geometryEngine.intersects(graphic.geometry, mapPoint)) {
              return { feature: feature, graphic: graphic };
            }
          }
        }
        return null;
      }

      async function getLandeignaskraMetadata(parcelProperties, parcelGraphic) {
        const landNumber = parcelProperties && parcelProperties.LANDEIGN_NR;
        if (landNumber === null || landNumber === undefined || landNumber === "") {
          return {
            parcel: { properties: parcelProperties || {} },
            graphic: parcelGraphic,
            skikar: [],
            skikarError: null
          };
        }
        const callbackName = "__landeignaskraSkikar_" + Date.now() + "_" +
          Math.floor(Math.random() * 1000000);
        const filter = "<Filter xmlns='http://www.opengis.net/ogc'>" +
          "<PropertyIsEqualTo><PropertyName> fasteignaskra:LANDEIGN_NR </PropertyName>" +
          "<Literal>" + escapeHtml(String(landNumber)) + "</Literal>" +
          "</PropertyIsEqualTo></Filter>";
        const skikarUrl = new URL("https://geo.fasteignaskra.is/ws/geoserver/wfs");
        skikarUrl.search = new URLSearchParams({
          service: "WFS",
          version: "1.1.0",
          request: "GetFeature",
          typename: "fasteignaskra:MV_LANDEIGNASKRA",
          outputFormat: "text/javascript",
          srsname: "EPSG:3057",
          format_options: "callback:" + callbackName,
          filter: filter
        }).toString();

        const featureCollection = await new Promise(function (resolve, reject) {
          const script = document.createElement("script");
          const timeout = setTimeout(function () {
            cleanup();
            reject(new Error("Tímamörk við að sækja tengda landeignaskika."));
          }, 15000);

          function cleanup() {
            clearTimeout(timeout);
            script.remove();
            delete window[callbackName];
          }

          window[callbackName] = function (data) {
            cleanup();
            resolve(data);
          };
          script.onerror = function () {
            cleanup();
            reject(new Error("WFS þjónustan skilaði ekki tengdum landeignaskikum."));
          };
          script.src = skikarUrl.toString();
          document.head.appendChild(script);
        });
        const skikar = featureCollection && featureCollection.features
          ? featureCollection.features
          : [];
        return {
          parcel: skikar[0] || { properties: parcelProperties || {} },
          graphic: parcelGraphic,
          skikar: skikar,
          skikarError: null
        };
      }

      function showLandeignaskraMetadata(metadata) {
        const parcel = metadata.parcel;
        const landNumber = parcel.properties && parcel.properties.LANDEIGN_NR;
        attrPanelTitle.textContent = "Landeignaskrá" +
          (landNumber !== undefined ? " — " + landNumber : "");
        let content = buildAttributeTable(parcel.properties || {});
        if (metadata.skikar.length) {
          content += "<h4>Tengdir landeignaskikar (" + metadata.skikar.length + ")</h4>";
          metadata.skikar.forEach(function (feature, index) {
            content += "<h5>Skiki " + (index + 1) + "</h5>" +
              buildAttributeTable(feature.properties || {});
          });
        } else if (metadata.skikarError) {
          content += "<p>Ekki tókst að sækja tengda landeignaskika: " +
            escapeHtml(metadata.skikarError.message) + "</p>";
        } else {
          content += "<p><em>Engir tengdir landeignaskikar fundust.</em></p>";
        }
        attrPanelBody.innerHTML = content;
        attrPanel.style.display = "block";
        highlightFeature(landeignaskra.layer, metadata.graphic);
      }

      async function identifyAdalskipulag(mapPoint) {
        const tolerance = view.resolution * 6;
        const identifyGeometry = geometryEngine.buffer(mapPoint, tolerance);
        const matches = await Promise.all(adalskipulagIdentifyLayers.map(async function (item) {
          const featureSet = await item.layer.queryFeatures({
            geometry: identifyGeometry,
            spatialRelationship: "intersects",
            outFields: ["*"],
            returnGeometry: true
          });
          return featureSet.features.length
            ? { title: item.title, layer: item.layer, graphic: featureSet.features[0] }
            : null;
        }));
        return matches.find(function (match) { return match; }) || null;
      }

      let mapClickRequestId = 0;
      view.on("click", function (event) {
        const clickRequestId = ++mapClickRequestId;
        view.hitTest(event, {
          include: allLiveLayers
            .filter(function (l) { return l !== landeignaskra && l !== nytjaland; })
            .map(function (l) { return l.layer; })
            .concat(arcgisFeatureLayers.map(function (l) { return l.layer; }))
        }).then(async function (response) {
          if (clickRequestId !== mapClickRequestId) return;
          let landeignResult = response.results.find(function (item) {
            return item.layer === landeignaskra.layer &&
              item.graphic && item.graphic.geometry;
          });
          if (landeignaskra.layer.visible && !landeignResult) {
            try {
              const identifyGeometry = geometryEngine.buffer(
                event.mapPoint,
                Math.max(view.resolution * 2, 0.1)
              );
              const parcels = await landeignaskra.layer.queryFeatures({
                geometry: identifyGeometry,
                spatialRelationship: "intersects",
                outFields: ["OBJECTID"],
                returnGeometry: true
              });
              if (clickRequestId !== mapClickRequestId) return;
              if (parcels.features.length) {
                landeignResult = {
                  layer: landeignaskra.layer,
                  graphic: parcels.features[0]
                };
              }
            } catch (err) {
              if (clickRequestId !== mapClickRequestId) return;
              console.error("Landeignaskrá identify WFS", err);
              attrPanelTitle.textContent = "Landeignaskrá";
              attrPanelBody.textContent = "Gat ekki sótt landeign við valinn stað: " + err.message;
              attrPanel.style.display = "block";
              clearHighlight();
              return;
            }
          }
          if (aaetladEignamork.layer.visible) {
            try {
              const identifyResult = await identifyAaetladEignamork(event.mapPoint);
              if (clickRequestId !== mapClickRequestId) return;
              if (identifyResult) {
                const properties = identifyResult.feature.properties || {};
                const label = properties.LANDEIGN_NR || properties.AE_SKIKI_NR;
                attrPanelTitle.textContent = aaetladEignamorkConfig.title +
                  (label !== undefined ? " — " + label : "");
                attrPanelBody.innerHTML = buildAttributeTable(properties);
                attrPanel.style.display = "block";
                highlightFeature(aaetladEignamork.layer, identifyResult.graphic);
                return;
              }
            } catch (err) {
              if (clickRequestId !== mapClickRequestId) return;
              console.error("Áætluð eignamörk WFS", err);
              attrPanelTitle.textContent = aaetladEignamorkConfig.title;
              attrPanelBody.textContent = "Gat ekki sótt lýsigögn: " + err.message;
              attrPanel.style.display = "block";
              clearHighlight();
              return;
            }
          }
          if (adalskipulagLayer.visible) {
            try {
              const identifyResult = await identifyAdalskipulag(event.mapPoint);
              if (clickRequestId !== mapClickRequestId) return;
              if (identifyResult) {
                attrPanelTitle.textContent = "Aðalskipulag — " + identifyResult.title;
                const fieldAliases = {};
                identifyResult.layer.fields.forEach(function (field) {
                  fieldAliases[field.name] = field.alias;
                });
                attrPanelBody.innerHTML = buildAttributeTable(
                  identifyResult.graphic.attributes,
                  null,
                  fieldAliases,
                  true
                );
                attrPanel.style.display = "block";
                highlightFeature(adalskipulagLayer, identifyResult.graphic);
                return;
              }
            } catch (err) {
              if (clickRequestId !== mapClickRequestId) return;
              console.error("Aðalskipulag GetFeatureInfo", err);
              attrPanelTitle.textContent = "Aðalskipulag";
              attrPanelBody.textContent = "Gat ekki sótt lýsigögn: " + err.message;
              attrPanel.style.display = "block";
              clearHighlight();
              return;
            }
          }
          if (landeignaskra.layer.visible && landeignResult) {
            try {
              const landeignObjectId = landeignResult.graphic.attributes.OBJECTID;
              const landeignProperties = landeignaskra.attributesCache.get(landeignObjectId) ||
                landeignResult.graphic.attributes;
              const metadata = await getLandeignaskraMetadata(
                landeignProperties,
                landeignResult.graphic
              );
              if (clickRequestId !== mapClickRequestId) return;
              if (metadata) {
                showLandeignaskraMetadata(metadata);
                return;
              }
            } catch (err) {
              if (clickRequestId !== mapClickRequestId) return;
              console.error("Landeignaskrá JSONP WFS", err);
              attrPanelTitle.textContent = "Landeignaskrá";
              attrPanelBody.textContent = "Gat ekki sótt lýsigögn: " + err.message;
              attrPanel.style.display = "block";
              clearHighlight();
              return;
            }
          }
          let result = response.results.find(function (item) {
            return item.graphic && item.graphic.geometry;
          });
          if (!result && nytjaland.layer.visible) {
            try {
              const identifyGeometry = geometryEngine.buffer(
                event.mapPoint,
                Math.max(view.resolution * 2, 0.1)
              );
              const features = await nytjaland.layer.queryFeatures({
                geometry: identifyGeometry,
                spatialRelationship: "intersects",
                outFields: ["OBJECTID"],
                returnGeometry: true
              });
              if (clickRequestId !== mapClickRequestId) return;
              if (features.features.length) {
                result = {
                  layer: nytjaland.layer,
                  graphic: features.features[0]
                };
              }
            } catch (err) {
              if (clickRequestId !== mapClickRequestId) return;
              console.error("Nytjaland identify WFS", err);
              attrPanelTitle.textContent = nytjaland.config.title;
              attrPanelBody.textContent = "Gat ekki sótt gögn við valinn stað: " + err.message;
              attrPanel.style.display = "block";
              clearHighlight();
              return;
            }
          }
          if (!result) {
            attrPanel.style.display = "none";
            clearHighlight();
            return;
          }
          const graphic = result.graphic;
          const objectId = graphic.attributes.OBJECTID;
          const layerTitle = result.layer ? result.layer.title : "Fyrirbæri";

          const matchedLayer = allLiveLayers.find(function (l) {
            return l.layer === result.layer;
          }) || arcgisFeatureLayers.find(function (l) {
            return l.layer === result.layer;
          });

          const fullAttributes = matchedLayer && matchedLayer.attributesCache
            ? matchedLayer.attributesCache.get(objectId)
            : graphic.attributes;
          const fieldAliases = matchedLayer &&
            matchedLayer.config.institution === "Vatnshlot"
            ? { WaterBodyID: "Name" }
            : null;

          attrPanelTitle.textContent = layerTitle;
          attrPanelBody.innerHTML = fullAttributes
            ? buildAttributeTable(
              fullAttributes,
              matchedLayer ? matchedLayer.config.valueMaps : null,
              fieldAliases,
              !!(matchedLayer && matchedLayer.config.linkifyUrls)
            )
            : "<em>Engin eigindi fundust fyrir þetta fyrirbæri.</em>";
          attrPanel.style.display = "block";

          highlightFeature(result.layer, graphic);
        });
      });

      const sketchLayer = new GraphicsLayer({ title: "Teiknað svæði" });
      map.add(sketchLayer);

      const sketch = new Sketch({
        layer: sketchLayer,
        view: view,
        creationMode: "update",
        visibleElements: {
          createTools: { point: false, polyline: false, polygon: true, rectangle: true, circle: true },
          selectionTools: { "rectangle-selection": false, "lasso-selection": false },
          settingsMenu: false,
          undoRedoMenu: false
        }
      });
      const sketchExpand = new Expand({
        view: view,
        content: sketch,
        expandIconClass: "esri-icon-edit",
        expandTooltip: "Teiknitæki",
        collapseTooltip: "Loka teiknitækjum"
      });
      sketchExpand.watch("expanded", function (expanded) {
        if (!expanded) {
          sketch.viewModel.cancel();
        }
      });
      view.ui.add(sketchExpand, "top-left");

      const measurementWidget = new Measurement({
        view: view,
        activeTool: null
      });
      const measurementPanel = document.createElement("div");
      measurementPanel.className = "measurementToolPanel";
      const measurementChoices = document.createElement("div");
      measurementChoices.className = "measurementToolChoices";
      const measurementContent = document.createElement("div");
      measurementContent.className = "measurementWidgetContent";
      measurementContent.setAttribute("role", "region");
      measurementContent.setAttribute("aria-label", "Niðurstöður mælingar");
      measurementWidget.container = measurementContent;

      const measurementToolButtons = {};
      [
        { tool: "distance", label: "Mæla vegalengd", icon: "esri-icon-measure-line" },
        { tool: "area", label: "Mæla flatarmál", icon: "esri-icon-measure-area" }
      ].forEach(function (item) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "measurementToolChoice";
        button.innerHTML = '<span class="' + item.icon + '" aria-hidden="true"></span> ' + item.label;
        button.setAttribute("aria-pressed", "false");
        button.addEventListener("click", function () {
          measurementWidget.activeTool = item.tool;
          measurementExpand.expanded = true;
        });
        measurementChoices.appendChild(button);
        measurementToolButtons[item.tool] = button;
      });

      measurementWidget.watch("activeTool", function (activeTool) {
        Object.keys(measurementToolButtons).forEach(function (tool) {
          const button = measurementToolButtons[tool];
          const active = tool === activeTool;
          button.classList.toggle("active", active);
          button.setAttribute("aria-pressed", String(active));
        });
      });
      measurementPanel.appendChild(measurementChoices);
      measurementPanel.appendChild(measurementContent);

      const measurementExpand = new Expand({
        view: view,
        content: measurementPanel,
        expandIconClass: "esri-icon-measure-line",
        expandTooltip: "Mælitæki",
        collapseTooltip: "Loka mælitækjum"
      });
      measurementExpand.watch("expanded", function (expanded) {
        if (!expanded) {
          measurementWidget.activeTool = null;
        } else if (!measurementWidget.activeTool) {
          measurementWidget.activeTool = "distance";
        }
      });
      view.ui.add(measurementExpand, { position: "top-left", index: 4 });

      const listPanel = document.getElementById("listPanel");
      const listPanelTitle = document.getElementById("listPanelTitle");
      const listPanelBody = document.getElementById("listPanelBody");
      document.getElementById("listPanelClose").addEventListener("click", function () {
        listPanel.style.display = "none";
        clearHighlight();
      });
      document.getElementById("listPanelClear").addEventListener("click", function () {
        sketchLayer.removeAll();
        listPanel.style.display = "none";
        clearHighlight();
      });

      sketch.on("create", function (event) {
        if (event.state === "start") {
          clearHighlight();
        }
        if (event.state === "complete") {
          runSpatialQuery(event.graphic.geometry);
        }
      });

      function pickDisplayLabel(attrs, labelField) {
        const candidates = [
          "ornefni", "heiti", "HEITI_NF", "SERHEITI", "VEF_BIRTING",
          "GERD", "ornefnaflokkur", "LANDEIGN_NR", "landnr", "LANDNR", "tegund"
        ];
        if (labelField && attrs[labelField] !== undefined && attrs[labelField] !== null && attrs[labelField] !== "") {
          return String(attrs[labelField]);
        }
        for (let i = 0; i < candidates.length; i++) {
          const v = attrs[candidates[i]];
          if (v !== undefined && v !== null && v !== "") return String(v);
        }
        return null;
      }

      async function runSpatialQuery(drawnGeometry) {
        listPanel.style.display = "block";
        listPanelTitle.textContent = "Leita...";
        listPanelBody.innerHTML = "<div style='padding:10px 14px;'><em>Sæki gögn fyrir teiknaða svæðið...</em></div>";

        const visibleWfsLayers = allLiveLayers.filter(function (l) {
          return l.layer.visible && l.refreshForExtent;
        });
        await Promise.all(visibleWfsLayers.map(function (l) {
          return l.refreshForExtent(drawnGeometry.extent);
        }));

        const resultsByLayer = [];

        for (const l of visibleWfsLayers) {
          try {
            const queryLayer = l.queryLayer || l.layer;
            const fs = await queryLayer.queryFeatures({
              where: "1=1",
              returnGeometry: true,
              outFields: ["OBJECTID"]
            });
            const matches = fs.features.filter(function (g) {
              try {
                return geometryEngine.intersects(drawnGeometry, g.geometry);
              } catch (e) {
                return false;
              }
            });
            if (matches.length) {
              resultsByLayer.push({
                title: l.config.title,
                layerRef: l.layer,
                config: l.config,
                items: matches.map(function (g) {
                  return {
                    attrs: l.attributesCache
                      ? (l.attributesCache.get(g.attributes.OBJECTID) || {})
                      : g.attributes,
                    graphic: g
                  };
                })
              });
            }
          } catch (e) {
            console.error("Villa við skörunarpróf fyrir " + l.config.title, e);
          }
        }

        for (const l of arcgisFeatureLayers) {
          if (!l.layer.visible || typeof l.layer.queryFeatures !== "function") continue;
          try {
            const fs2 = await l.layer.queryFeatures({
              geometry: drawnGeometry,
              spatialRelationship: "intersects",
              outFields: ["*"],
              returnGeometry: true
            });
            if (fs2.features.length) {
              resultsByLayer.push({
                title: l.config.title,
                layerRef: l.layer,
                config: l.config,
                items: fs2.features.map(function (g) {
                  return { attrs: g.attributes, graphic: g };
                })
              });
            }
          } catch (e) {
            console.error("Villa við staðbundna fyrirspurn fyrir " + l.config.title, e);
          }
        }

        renderListPanel(resultsByLayer);
      }

      function renderListPanel(resultsByLayer) {
        const totalCount = resultsByLayer.reduce(function (sum, r) { return sum + r.items.length; }, 0);
        listPanelTitle.textContent = "Fyrirbæri innan svæðis (" + totalCount + ")";

        listPanelBody.innerHTML = "";

        if (!resultsByLayer.length) {
          const emptyEl = document.createElement("div");
          emptyEl.style.padding = "10px 14px";
          emptyEl.innerHTML = "<em>Engin fyrirbæri fundust innan teiknaða svæðisins.</em>";
          listPanelBody.appendChild(emptyEl);
          return;
        }

        resultsByLayer.forEach(function (group) {
          const headerEl = document.createElement("div");
          headerEl.className = "listGroupHeader";
          headerEl.textContent = group.title + " (" + group.items.length + ")";
          listPanelBody.appendChild(headerEl);

          group.items.forEach(function (item, idx) {
            const rowEl = document.createElement("div");
            rowEl.className = "listItemRow";
            rowEl.textContent = pickDisplayLabel(item.attrs, group.config ? group.config.labelField : null) || ("Fyrirbæri #" + (idx + 1));
            rowEl.addEventListener("click", function () {
              attrPanelTitle.textContent = group.title;
              attrPanelBody.innerHTML = buildAttributeTable(
                item.attrs,
                group.config ? group.config.valueMaps : null,
                null,
                !!(group.config && group.config.linkifyUrls)
              );
              attrPanel.style.display = "block";
              highlightFeature(group.layerRef, item.graphic);

              listPanelBody.querySelectorAll(".listItemRow.active").forEach(function (el) {
                el.classList.remove("active");
              });
              rowEl.classList.add("active");
            });
            listPanelBody.appendChild(rowEl);
          });
        });
      }


      // ---------------------------------------------------------
      // LEIT Í LANDEIGNASKRÁ
      // Leitar í Staðfangaskrá HMS yfir allt landið, óháð kortasvæði.
      // ---------------------------------------------------------
      const landSearchInput = document.getElementById("landSearchInput");
      const landSearchResults = document.getElementById("landSearchResults");
      const landSearchClear = document.getElementById("landSearchClear");
      let landSearchTimer = null;
      let landSearchItems = [];
      let landSearchActiveIndex = -1;
      let landSearchRequestId = 0;

      const LAND_NUMBER_FIELDS = ["LANDNR", "landnr", "LANDEIGN_NR", "landeign_nr", "LANDEIGNANR", "landeignanr"];
      const LAND_NAME_FIELDS = [
        "VEF_BIRTING", "LM_HEIMILISFANG", "SERHEITI", "HEITI_NF",
        "HEITI_TGF", "HEITI", "heiti", "heiti_nf", "NAFN", "nafn", "ornefni"
      ];

      function firstAttributeValue(attrs, fields) {
        for (let i = 0; i < fields.length; i++) {
          const value = attrs[fields[i]];
          if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
        }
        return "";
      }

      function normalizeLandSearchValue(value) {
        return String(value || "").toLocaleLowerCase("is-IS").trim();
      }

      function hideLandSearchResults() {
        landSearchResults.style.display = "none";
        landSearchInput.setAttribute("aria-expanded", "false");
        landSearchActiveIndex = -1;
      }

      function showLandSearchMessage(message) {
        landSearchResults.innerHTML = '<div id="landSearchStatus">' + escapeHtml(message) + '</div>';
        landSearchResults.style.display = "block";
        landSearchInput.setAttribute("aria-expanded", "true");
      }

      async function searchLandeignir() {
        const requestId = ++landSearchRequestId;
        const rawText = landSearchInput.value.trim();
        const searchText = normalizeLandSearchValue(rawText);
        landSearchClear.style.display = rawText ? "block" : "none";
        if (searchText.length < 2) {
          hideLandSearchResults();
          return;
        }

        showLandSearchMessage("Leita...");
        try {
          const escapedText = rawText.replace(/'/g, "''");
          const textFields = [
            "VEF_BIRTING", "LM_HEIMILISFANG", "HEITI_NF",
            "HEITI_TGF", "SERHEITI", "HUSMERKING"
          ];
          const textFilter = textFields.map(function (fieldName) {
            return fieldName + " ILIKE '%" + escapedText + "%'";
          });
          if (/^\d+$/.test(rawText)) {
            textFilter.push("LANDNR = " + rawText);
          }

          const params = new URLSearchParams({
            service: "WFS",
            version: "2.0.0",
            request: "GetFeature",
            typeName: "public:Stadfangaskra",
            outputFormat: "application/json",
            srsName: "EPSG:3057",
            count: "100",
            CQL_FILTER: textFilter.join(" OR ")
          });
          const response = await fetch(stadfangaskra.config.url + "?" + params.toString());
          if (!response.ok) throw new Error("HTTP " + response.status);
          const featureCollection = await response.json();
          if (requestId !== landSearchRequestId) return;

          const matchedFeatures = (featureCollection.features || []).filter(function (feature) {
            return feature.geometry && feature.geometry.type === "Point";
          });
          landSearchItems = matchedFeatures.map(function (feature) {
            const attrs = feature.properties || {};
            const landNumber = firstAttributeValue(attrs, LAND_NUMBER_FIELDS);
            const name = firstAttributeValue(attrs, LAND_NAME_FIELDS);
            const coordinates = feature.geometry.coordinates;
            const graphic = new Graphic({
              geometry: {
                type: "point",
                x: coordinates[0],
                y: coordinates[1],
                spatialReference: { wkid: 3057 }
              },
              attributes: attrs
            });
            return { graphic: graphic, attrs: attrs, landNumber: landNumber, name: name };
          }).sort(function (a, b) {
            const aExact = normalizeLandSearchValue(a.landNumber) === searchText ? 0 : 1;
            const bExact = normalizeLandSearchValue(b.landNumber) === searchText ? 0 : 1;
            if (aExact !== bExact) return aExact - bExact;
            return (a.name || a.landNumber).localeCompare(b.name || b.landNumber, "is");
          }).slice(0, 25);

          renderLandSearchResults(matchedFeatures.length);
        } catch (error) {
          if (requestId !== landSearchRequestId) return;
          console.error("Villa í landeignaleit", error);
          showLandSearchMessage("Ekki tókst að framkvæma leitina.");
        }
      }

      function renderLandSearchResults(matchCount) {
        landSearchResults.innerHTML = "";
        landSearchActiveIndex = -1;
        if (!landSearchItems.length) {
          showLandSearchMessage("Engin samsvörun fannst á landinu öllu.");
          return;
        }

        landSearchItems.forEach(function (item, index) {
          const resultEl = document.createElement("div");
          resultEl.className = "landSearchResult";
          resultEl.setAttribute("role", "option");
          const address = firstAttributeValue(item.attrs, ["VEF_BIRTING"]) || item.name || "Ónefnd landeign";
          const landNumberSuffix = item.landNumber ? " (" + item.landNumber + ")" : "";
          const addressWithoutLandNumber = landNumberSuffix &&
            address.endsWith(landNumberSuffix)
            ? address.slice(0, -landNumberSuffix.length)
            : address;
          const postalCode = firstAttributeValue(item.attrs, ["POSTNR"]);
          resultEl.innerHTML =
            '<div class="landSearchResultTitle">' + escapeHtml(addressWithoutLandNumber + landNumberSuffix) + '</div>' +
            '<div class="landSearchResultMeta">Póstnúmer: ' + escapeHtml(postalCode || "óskráð") + '</div>';
          resultEl.addEventListener("click", function () { selectLandeign(item); });
          landSearchResults.appendChild(resultEl);
        });

        const statusEl = document.createElement("div");
        statusEl.id = "landSearchStatus";
        statusEl.textContent = matchCount >= 100
          ? "Sýni fyrstu " + landSearchItems.length + " niðurstöðurnar af að minnsta kosti 100 á landinu öllu."
          : matchCount + " niðurstöður á landinu öllu.";
        landSearchResults.appendChild(statusEl);
        landSearchResults.style.display = "block";
        landSearchInput.setAttribute("aria-expanded", "true");
      }

      async function selectLandeign(item) {
        hideLandSearchResults();
        landSearchInput.value = item.landNumber || item.name;
        landSearchClear.style.display = "block";

        try {
          const target = item.graphic.geometry.extent
            ? item.graphic.geometry.extent.expand(1.8)
            : item.graphic.geometry;
          await view.goTo(target, { duration: 700 });
        } catch (error) {
          console.warn("Ekki tókst að færa kortið að landeigninni", error);
        }

        highlightFeature(stadfangaskra.layer, item.graphic);
        attrPanelTitle.textContent = item.name || "Landeign";
        attrPanelBody.innerHTML = buildAttributeTable(item.attrs, stadfangaskra.config.valueMaps);
        attrPanel.style.display = "block";
      }

      landSearchInput.addEventListener("input", function () {
        landSearchRequestId++;
        clearTimeout(landSearchTimer);
        landSearchTimer = setTimeout(searchLandeignir, 300);
      });

      landSearchInput.addEventListener("keydown", function (event) {
        const rows = landSearchResults.querySelectorAll(".landSearchResult");
        if (event.key === "ArrowDown" && rows.length) {
          event.preventDefault();
          landSearchActiveIndex = Math.min(landSearchActiveIndex + 1, rows.length - 1);
        } else if (event.key === "ArrowUp" && rows.length) {
          event.preventDefault();
          landSearchActiveIndex = Math.max(landSearchActiveIndex - 1, 0);
        } else if (event.key === "Enter") {
          event.preventDefault();
          const index = landSearchActiveIndex >= 0 ? landSearchActiveIndex : 0;
          if (landSearchItems[index]) selectLandeign(landSearchItems[index]);
          return;
        } else if (event.key === "Escape") {
          hideLandSearchResults();
          return;
        } else {
          return;
        }
        rows.forEach(function (row, index) { row.classList.toggle("active", index === landSearchActiveIndex); });
        if (rows[landSearchActiveIndex]) rows[landSearchActiveIndex].scrollIntoView({ block: "nearest" });
      });

      landSearchClear.addEventListener("click", function () {
        landSearchRequestId++;
        landSearchInput.value = "";
        landSearchClear.style.display = "none";
        hideLandSearchResults();
        clearHighlight();
        landSearchInput.focus();
      });

      document.addEventListener("click", function (event) {
        if (!document.getElementById("landSearchPanel").contains(event.target)) hideLandSearchResults();
      });

      // =========================================================
      // PRENTLAYOUT FYRIR A4 LANDSCAPE
      // =========================================================
      let printView = null;
      let printWatchHandle = null;
      let printAaetladTimer = null;
      let printHmsOverlaysInitialized = false;

      const printOverlay = document.getElementById("printOverlay");
      const printStatus = document.getElementById("printStatus");
      const printButton = document.createElement("button");
      printButton.type = "button";
      printButton.className = "esri-widget--button esri-widget esri-interactive";
      printButton.title = "Prenta kort";
      printButton.setAttribute("aria-label", "Prenta kort");
      printButton.innerHTML = '<span aria-hidden="true" class="esri-icon-printer"></span>';
      view.ui.add(printButton, { position: "top-left", index: 2 });

      function localIsoDate() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return y + "-" + m + "-" + day;
      }

      function formatIcelandicDate(value) {
        if (!value) return "";
        const parts = value.split("-");
        return parts.length === 3 ? parts[2] + "." + parts[1] + "." + parts[0] : value;
      }

      function bindPrintField(controlId, sheetId, eventName) {
        const control = document.getElementById(controlId);
        const sheet = document.getElementById(sheetId);
        function copyToSheet() {
          if ("value" in sheet) sheet.value = control.value;
          else sheet.textContent = control.value;
        }
        function copyToControl() {
          if ("value" in sheet) control.value = sheet.value;
        }
        control.addEventListener(eventName || "input", copyToSheet);
        if ("value" in sheet) sheet.addEventListener("input", copyToControl);
        copyToSheet();
      }

      bindPrintField("controlProject", "sheetProject");
      bindPrintField("controlDescription", "sheetDescription");
      bindPrintField("controlLandNo", "sheetLandNo");
      bindPrintField("controlDrawingNo", "sheetDrawingNo");
      bindPrintField("controlSheetNo", "sheetSheetNo");

      document.getElementById("controlDrawnBy").addEventListener("input", function () {
        document.getElementById("sheetDrawnText").value = this.value;
      });
      document.getElementById("sheetDrawnText").addEventListener("input", function () {
        document.getElementById("controlDrawnBy").value = this.value;
      });

      function niceScaleDistance(targetMeters) {
        const power = Math.pow(10, Math.floor(Math.log10(Math.max(targetMeters, 1))));
        const normalized = targetMeters / power;
        const nice = normalized < 1.5 ? 1 : normalized < 3.5 ? 2 : normalized < 7.5 ? 5 : 10;
        return nice * power;
      }

      function updatePrintScale() {
        if (!printView || !isFinite(printView.scale)) return;
        const scale = Math.round(printView.scale);
        document.getElementById("sheetScale").textContent = "1:" + scale.toLocaleString("is-IS");

        // A 40 mm scale bar on paper represents scale * 0.04 m on the ground.
        const fullDistance = niceScaleDistance(scale * 0.04);
        const halfDistance = fullDistance / 2;
        const label = fullDistance >= 1000
          ? (fullDistance / 1000).toLocaleString("is-IS", { maximumFractionDigits: 2 }) + " km"
          : Math.round(fullDistance).toLocaleString("is-IS") + " m";
        const halfLabel = halfDistance >= 1000
          ? (halfDistance / 1000).toLocaleString("is-IS", { maximumFractionDigits: 2 })
          : Math.round(halfDistance).toLocaleString("is-IS");
        document.getElementById("printScaleBarMiddle").textContent = halfLabel;
        document.getElementById("printScaleBarEnd").textContent = label;
      }

      function refreshPrintAaetladOverlay() {
        clearTimeout(printAaetladTimer);
        printAaetladTimer = setTimeout(function () {
          const img = document.getElementById("printAaetladOverlay");
          if (!printView || !printView.stationary || !printView.extent || !aaetladEignamork.layer.visible) {
            img.style.display = "none";
            return;
          }
          const params = new URLSearchParams({
            BBOX: [printView.extent.xmin, printView.extent.ymin, printView.extent.xmax, printView.extent.ymax].join(","),
            HEIGHT: String(Math.max(1, Math.round(printView.height))),
            WIDTH: String(Math.max(1, Math.round(printView.width)))
          });
          img.onload = function () { img.style.display = aaetladEignamork.layer.visible ? "block" : "none"; };
          img.onerror = function () { img.style.display = "none"; };
          img.src = aaetladEignamorkConfig.url + "?" + params.toString();
        }, 120);
      }

      function initializePrintHmsOverlays() {
        if (printHmsOverlaysInitialized) return;
        printHmsOverlaysInitialized = true;

        [
          { layerObject: landeignaskra, config: landeignaskraConfig, zIndex: 1 },
          { layerObject: nytjaland, config: nytjaland.config, zIndex: 2 }
        ].filter(function (overlayConfig) {
          return !overlayConfig.config.vectorOnly;
        }).forEach(function (overlayConfig) {
          const image = document.createElement("img");
          image.alt = "";
          image.setAttribute("aria-hidden", "true");
          image.style.cssText =
            "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;" +
            "object-fit:fill;display:none;z-index:" + overlayConfig.zIndex + ";";
          document.getElementById("printMapFrame").appendChild(image);

          let refreshTimer = null;
          let requestId = 0;

          function scheduleRefresh() {
            clearTimeout(refreshTimer);
            if (!overlayConfig.layerObject.layer.visible) {
              requestId++;
              image.style.display = "none";
              return;
            }
            if (!printView.stationary) {
              requestId++;
              if (!overlayConfig.config.retainPreviousImage) image.style.display = "none";
              return;
            }

            refreshTimer = setTimeout(function () {
              if (!printView.extent || printView.width < 1 || printView.height < 1) return;

              const currentRequestId = ++requestId;
              const params = new URLSearchParams({
                BBOX: [
                  printView.extent.xmin,
                  printView.extent.ymin,
                  printView.extent.xmax,
                  printView.extent.ymax
                ].join(","),
                HEIGHT: String(Math.round(printView.height)),
                WIDTH: String(Math.round(printView.width))
              });
              const nextImage = new Image();
              nextImage.onload = function () {
                if (
                  currentRequestId !== requestId ||
                  !overlayConfig.layerObject.layer.visible ||
                  !printView.stationary
                ) return;
                image.src = nextImage.src;
                image.style.display = "block";
              };
              nextImage.onerror = function () {
                if (currentRequestId !== requestId) return;
                if (!overlayConfig.config.retainPreviousImage) image.style.display = "none";
                console.error("Gat ekki sótt prentmynd fyrir " + overlayConfig.config.title);
              };
              if (!overlayConfig.config.retainPreviousImage || !image.src) {
                image.style.display = "none";
              }
              nextImage.src = overlayConfig.config.imageUrl + "?" + params.toString();
            }, 120);
          }

          overlayConfig.layerObject.layer.watch("visible", scheduleRefresh);
          printView.watch(["extent", "size"], scheduleRefresh);
          printView.watch("stationary", function (stationary) {
            if (stationary) scheduleRefresh();
            else {
              requestId++;
              if (!overlayConfig.config.retainPreviousImage) image.style.display = "none";
            }
          });
          scheduleRefresh();
        });
      }

      async function ensurePrintView() {
        if (printView) return printView;
        printView = new MapView({
          container: "printMapView",
          map: map,
          spatialReference: view.spatialReference,
          extent: view.extent ? view.extent.clone() : null,
          constraints: { snapToZoom: false },
          ui: { components: [] }
        });
        await printView.when();
        initializePrintHmsOverlays();
        if (nytjaland.layer.visible && printView.extent) {
          nytjaland.refreshForExtent(printView.extent);
        }
        printView.watch("stationary", function (stationary) {
          if (stationary && nytjaland.layer.visible && printView.extent) {
            nytjaland.refreshForExtent(printView.extent);
          }
        });
        printWatchHandle = printView.watch(["scale", "stationary"], function () {
          updatePrintScale();
          if (printView.stationary) refreshPrintAaetladOverlay();
        });

        // Keep the print north arrow pointing to geographic north when the map rotates.
        function updatePrintNorthArrow() {
          const arrow = document.querySelector("#printNorthArrow .northGlyph");
          if (!arrow) return;
          const rotation = Number(printView.rotation) || 0;
          arrow.style.transform = "rotate(" + rotation + "deg) scaleX(.72)";
        }
        printView.watch("rotation", updatePrintNorthArrow);
        updatePrintNorthArrow();
        printView.watch("extent", function () {
          if (printView.stationary) refreshPrintAaetladOverlay();
        });
        aaetladEignamork.layer.watch("visible", refreshPrintAaetladOverlay);
        updatePrintScale();
        refreshPrintAaetladOverlay();
        return printView;
      }

      async function copyCurrentExtentToPrint() {
        await ensurePrintView();
        if (view.extent) {
          await printView.goTo(view.extent.clone(), { animate: false });
          updatePrintScale();
          refreshPrintAaetladOverlay();
        }
      }

      async function openPrintLayout() {
        printOverlay.classList.add("open");
        printOverlay.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        printStatus.textContent = "Undirbý prentsíðu...";
        await ensurePrintView();
        await copyCurrentExtentToPrint();
        requestAnimationFrame(function () {
          printView.resize();
          updatePrintScale();
          printStatus.textContent = "Þú getur fært og þysjað kortið inni í prentsíðunni áður en þú prentar.";
        });
      }

      function closePrintLayout() {
        printOverlay.classList.remove("open");
        printOverlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
      }

      printButton.addEventListener("click", openPrintLayout);
      document.getElementById("printCloseButton").addEventListener("click", closePrintLayout);
      document.getElementById("printResetExtentButton").addEventListener("click", copyCurrentExtentToPrint);
      document.getElementById("controlScale").addEventListener("change", async function () {
        await ensurePrintView();
        if (this.value === "current") {
          await copyCurrentExtentToPrint();
        } else {
          printView.scale = Number(this.value);
          updatePrintScale();
        }
      });
      document.getElementById("printNowButton").addEventListener("click", async function () {
        await ensurePrintView();
        printStatus.textContent = "Bíð eftir að kortið klári að teiknast...";
        try {
          await printView.when(function () { return printView.stationary; });
        } catch (e) {
          console.warn("Prentkort náði ekki stationary stöðu", e);
        }
        updatePrintScale();
        refreshPrintAaetladOverlay();
        setTimeout(function () {
          window.print();
          printStatus.textContent = "Prentgluggi opnaður. Veldu Save as PDF til að vista PDF.";
        }, 250);
      });
      printOverlay.addEventListener("keydown", function (event) {
        if (event.key === "Escape") closePrintLayout();
      });
      window.addEventListener("afterprint", function () {
        if (printView) printView.resize();
      });

    });
