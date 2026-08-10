const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function writeFile(filePath, contents) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, contents);
}

function javaPackagePath(packageName) {
  return packageName.split('.').join(path.sep);
}

function addReceiver(androidManifest, className, label, providerResource) {
  const application = androidManifest.manifest.application?.[0];
  if (!application) return androidManifest;

  application.receiver = application.receiver ?? [];
  const receiverName = `.${className}`;
  const exists = application.receiver.some(
    (receiver) => receiver.$?.['android:name'] === receiverName,
  );
  if (exists) return androidManifest;

  application.receiver.push({
    $: {
      'android:name': receiverName,
      'android:exported': 'true',
      'android:label': label,
    },
    'intent-filter': [
      {
        action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }],
      },
    ],
    'meta-data': [
      {
        $: {
          'android:name': 'android.appwidget.provider',
          'android:resource': providerResource,
        },
      },
    ],
  });

  return androidManifest;
}

function useRevenueCatSafeLaunchMode(androidManifest) {
  const application = androidManifest.manifest.application?.[0];
  if (!application?.activity) return androidManifest;

  application.activity.forEach((activity) => {
    if (activity.$?.['android:name'] === '.MainActivity') {
      activity.$['android:launchMode'] = 'singleTop';
    }
  });

  return androidManifest;
}

function patchMainApplication(projectRoot, packageName) {
  const mainApplicationPath = path.join(
    projectRoot,
    'android/app/src/main/java',
    javaPackagePath(packageName),
    'MainApplication.kt',
  );

  if (!fs.existsSync(mainApplicationPath)) return;

  let contents = fs.readFileSync(mainApplicationPath, 'utf8');
  const importLine = `import ${packageName}.widgets.AirAwareWidgetPackage`;
  if (!contents.includes(importLine)) {
    contents = contents.replace(/^package .+$/m, (match) => `${match}\n\n${importLine}`);
  }

  if (!contents.includes('AirAwareWidgetPackage()')) {
    const lines = contents.split('\n');
    const returnIndex = lines.findIndex((line) => line.trim() === 'return packages');
    if (returnIndex >= 0) {
      const indent = lines[returnIndex].match(/^\s*/)?.[0] ?? '';
      lines.splice(returnIndex, 0, `${indent}packages.add(AirAwareWidgetPackage())`);
      contents = lines.join('\n');
    }
  }

  fs.writeFileSync(mainApplicationPath, contents);
}

function widgetJava(packageName) {
  const widgetPackage = `${packageName}.widgets`;
  return {
    snapshot: `package ${widgetPackage};

import org.json.JSONArray;
import org.json.JSONObject;

final class AirAwareWidgetSnapshot {
  static final String PREFS_NAME = "airaware_widget_snapshot";
  static final String SNAPSHOT_KEY = "snapshot";

  final boolean compactAvailable;
  final boolean advancedAvailable;
  final boolean stale;
  final String title;
  final String scoreLine;
  final String mainFactor;
  final String uvLine;
  final String bestWindow;
  final String message;
  final String category;
  final String[] forecastLines;

  private AirAwareWidgetSnapshot(
      boolean compactAvailable,
      boolean advancedAvailable,
      boolean stale,
      String title,
      String scoreLine,
      String mainFactor,
      String uvLine,
      String bestWindow,
      String message,
      String category,
      String[] forecastLines) {
    this.compactAvailable = compactAvailable;
    this.advancedAvailable = advancedAvailable;
    this.stale = stale;
    this.title = title;
    this.scoreLine = scoreLine;
    this.mainFactor = mainFactor;
    this.uvLine = uvLine;
    this.bestWindow = bestWindow;
    this.message = message;
    this.category = category;
    this.forecastLines = forecastLines;
  }

  static AirAwareWidgetSnapshot empty() {
    return new AirAwareWidgetSnapshot(
        true,
        false,
        false,
        "😷 AirAware",
        null,
        null,
        null,
        null,
        "Open the app to finish setup",
        "unavailable",
        new String[0]);
  }

  static AirAwareWidgetSnapshot fromJson(String json, boolean advanced) {
    if (json == null || json.trim().isEmpty()) {
      return empty();
    }

    try {
      JSONObject object = new JSONObject(json);
      if (object.optInt("version") != 1) return empty();

      boolean showPlace = object.optBoolean("showPlaceName", true);
      String placeName = nullableString(object, "placeName");
      boolean advancedAvailable = object.optBoolean("advancedAvailable", false);
      String title = advanced && !advancedAvailable
          ? "😷 AirAware Pro"
          : title(showPlace, placeName, advanced);
      JSONObject score = object.optJSONObject("headlineScore");
      String category = score != null ? score.optString("category", "unavailable") : "unavailable";
      String scoreLine = score != null
          ? score.optString("categoryLabel", "Unavailable") + " · " + score.optString("scoreLabel", "")
          : null;
      String mainFactor = nullableString(object, "mainFactorLabel");
      String uv = nullableString(object, "uvCategoryLabel");
      String bestWindow = nullableString(object, "bestOutdoorWindowLabel");
      JSONArray days = object.optJSONArray("forecastDays");
      String[] forecastLines = forecastLines(days);

      return new AirAwareWidgetSnapshot(
          object.optBoolean("compactAvailable", true),
          advancedAvailable,
          object.optBoolean("stale", false),
          title,
          scoreLine,
          mainFactor,
          uv != null ? "UV " + uv : null,
          bestWindow,
          null,
          category,
          forecastLines);
    } catch (Exception ignored) {
      return empty();
    }
  }

  private static String title(boolean showPlace, String placeName, boolean advanced) {
    if (showPlace && placeName != null && !placeName.isEmpty()) {
      return "😷 AirAware — " + placeName;
    }
    return advanced ? "😷 AirAware Pro" : "😷 AirAware";
  }

  private static String nullableString(JSONObject object, String key) {
    if (object.isNull(key)) return null;
    String value = object.optString(key, null);
    return value == null || value.isEmpty() ? null : value;
  }

  private static String[] forecastLines(JSONArray days) {
    if (days == null) return new String[0];
    int count = Math.min(4, days.length());
    String[] lines = new String[count];
    for (int index = 0; index < count; index += 1) {
      JSONObject day = days.optJSONObject(index);
      if (day == null) {
        lines[index] = "";
      } else {
        lines[index] = day.optString("label", "") + "  "
            + day.optString("categoryLabel", "") + " · "
            + day.optString("scoreLabel", "");
      }
    }
    return lines;
  }
}
`,
    renderer: `package ${widgetPackage};

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import ${packageName}.R;

final class AirAwareWidgetRenderer {
  private AirAwareWidgetRenderer() {}

  static RemoteViews compact(Context context) {
    AirAwareWidgetSnapshot snapshot = snapshot(context, false);
    RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.airaware_widget_compact);
    views.setTextViewText(R.id.airaware_widget_title, snapshot.title);
    views.setTextViewText(R.id.airaware_widget_score, valueOr(snapshot.scoreLine, "Open the app"));
    views.setTextColor(R.id.airaware_widget_score, colorForCategory(snapshot.category));
    setOptionalText(views, R.id.airaware_widget_main_factor, snapshot.mainFactor);
    setOptionalText(views, R.id.airaware_widget_uv, snapshot.uvLine);
    setOptionalText(views, R.id.airaware_widget_message, snapshot.stale ? "Cached data" : snapshot.message);
    views.setOnClickPendingIntent(R.id.airaware_widget_root, pendingIntent(context, "today", 1001));
    return views;
  }

  static RemoteViews advanced(Context context) {
    AirAwareWidgetSnapshot snapshot = snapshot(context, true);
    RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.airaware_widget_advanced);
    views.setTextViewText(R.id.airaware_widget_title, snapshot.advancedAvailable ? snapshot.title : "😷 AirAware Pro");

    if (!snapshot.advancedAvailable) {
      views.setTextViewText(R.id.airaware_widget_score_label, "Extended home widget");
      views.setTextViewText(R.id.airaware_widget_score, "Open AirAware to learn more");
      views.setTextColor(R.id.airaware_widget_score, colorForCategory("unavailable"));
      hideDetails(views);
      views.setOnClickPendingIntent(R.id.airaware_widget_root, pendingIntent(context, "settings", 1002));
      return views;
    }

    views.setTextViewText(R.id.airaware_widget_score_label, "Current score");
    views.setTextViewText(R.id.airaware_widget_score, valueOr(snapshot.scoreLine, "Open the app to load data"));
    views.setTextColor(R.id.airaware_widget_score, colorForCategory(snapshot.category));
    setOptionalText(views, R.id.airaware_widget_main_factor, snapshot.mainFactor != null ? "Main factor\\n" + snapshot.mainFactor : null);
    setOptionalText(views, R.id.airaware_widget_best_window, snapshot.bestWindow != null ? "Best outdoor window\\n" + snapshot.bestWindow : null);
    setForecastLine(views, R.id.airaware_widget_forecast_1, snapshot.forecastLines, 0);
    setForecastLine(views, R.id.airaware_widget_forecast_2, snapshot.forecastLines, 1);
    setForecastLine(views, R.id.airaware_widget_forecast_3, snapshot.forecastLines, 2);
    setForecastLine(views, R.id.airaware_widget_forecast_4, snapshot.forecastLines, 3);
    setOptionalText(views, R.id.airaware_widget_message, snapshot.stale ? "Cached data" : null);
    views.setOnClickPendingIntent(R.id.airaware_widget_root, pendingIntent(context, "forecast", 1003));
    return views;
  }

  private static AirAwareWidgetSnapshot snapshot(Context context, boolean advanced) {
    String json = context
        .getSharedPreferences(AirAwareWidgetSnapshot.PREFS_NAME, Context.MODE_PRIVATE)
        .getString(AirAwareWidgetSnapshot.SNAPSHOT_KEY, null);
    return AirAwareWidgetSnapshot.fromJson(json, advanced);
  }

  private static PendingIntent pendingIntent(Context context, String destination, int requestCode) {
    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("airaware://" + destination));
    intent.setPackage(context.getPackageName());
    return PendingIntent.getActivity(
        context,
        requestCode,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }

  private static void setOptionalText(RemoteViews views, int id, String text) {
    if (text == null || text.isEmpty()) {
      views.setViewVisibility(id, View.GONE);
    } else {
      views.setViewVisibility(id, View.VISIBLE);
      views.setTextViewText(id, text);
    }
  }

  private static void setForecastLine(RemoteViews views, int id, String[] lines, int index) {
    if (lines.length <= index || lines[index] == null || lines[index].isEmpty()) {
      views.setViewVisibility(id, View.GONE);
    } else {
      views.setViewVisibility(id, View.VISIBLE);
      views.setTextViewText(id, lines[index]);
    }
  }

  private static void hideDetails(RemoteViews views) {
    views.setViewVisibility(R.id.airaware_widget_main_factor, View.GONE);
    views.setViewVisibility(R.id.airaware_widget_best_window, View.GONE);
    views.setViewVisibility(R.id.airaware_widget_forecast_label, View.GONE);
    views.setViewVisibility(R.id.airaware_widget_forecast_1, View.GONE);
    views.setViewVisibility(R.id.airaware_widget_forecast_2, View.GONE);
    views.setViewVisibility(R.id.airaware_widget_forecast_3, View.GONE);
    views.setViewVisibility(R.id.airaware_widget_forecast_4, View.GONE);
    views.setViewVisibility(R.id.airaware_widget_message, View.GONE);
  }

  private static String valueOr(String value, String fallback) {
    return value == null || value.isEmpty() ? fallback : value;
  }

  private static int colorForCategory(String category) {
    if ("low".equals(category)) return Color.rgb(47, 125, 70);
    if ("moderate".equals(category)) return Color.rgb(184, 134, 11);
    if ("high".equals(category)) return Color.rgb(218, 124, 46);
    if ("veryHigh".equals(category)) return Color.rgb(196, 64, 64);
    return Color.rgb(108, 117, 125);
  }
}
`,
    compactProvider: `package ${widgetPackage};

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

public class AirAwareCompactWidgetProvider extends AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    updateAll(context, appWidgetManager, appWidgetIds);
  }

  static void updateAll(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    for (int appWidgetId : appWidgetIds) {
      appWidgetManager.updateAppWidget(appWidgetId, AirAwareWidgetRenderer.compact(context));
    }
  }
}
`,
    advancedProvider: `package ${widgetPackage};

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

public class AirAwareAdvancedWidgetProvider extends AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    updateAll(context, appWidgetManager, appWidgetIds);
  }

  static void updateAll(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    for (int appWidgetId : appWidgetIds) {
      appWidgetManager.updateAppWidget(appWidgetId, AirAwareWidgetRenderer.advanced(context));
    }
  }
}
`,
    module: `package ${widgetPackage};

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class AirAwareWidgetModule extends ReactContextBaseJavaModule {
  public AirAwareWidgetModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @NonNull
  @Override
  public String getName() {
    return "AirAwareWidgetModule";
  }

  @ReactMethod
  public void saveSnapshot(String snapshotJson, Promise promise) {
    try {
      Context context = getReactApplicationContext();
      context
          .getSharedPreferences(AirAwareWidgetSnapshot.PREFS_NAME, Context.MODE_PRIVATE)
          .edit()
          .putString(AirAwareWidgetSnapshot.SNAPSHOT_KEY, snapshotJson)
          .apply();

      AppWidgetManager manager = AppWidgetManager.getInstance(context);
      AirAwareCompactWidgetProvider.updateAll(
          context,
          manager,
          manager.getAppWidgetIds(new ComponentName(context, AirAwareCompactWidgetProvider.class)));
      AirAwareAdvancedWidgetProvider.updateAll(
          context,
          manager,
          manager.getAppWidgetIds(new ComponentName(context, AirAwareAdvancedWidgetProvider.class)));
      promise.resolve(true);
    } catch (Exception error) {
      promise.reject("AIRAWARE_WIDGET_SAVE_FAILED", error);
    }
  }
}
`,
    rnPackage: `package ${widgetPackage};

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class AirAwareWidgetPackage implements ReactPackage {
  @Override
  public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
    List<NativeModule> modules = new ArrayList<>();
    modules.add(new AirAwareWidgetModule(reactContext));
    return modules;
  }

  @Override
  public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
    return Collections.emptyList();
  }
}
`,
  };
}

const COMPACT_LAYOUT = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/airaware_widget_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:background="@drawable/airaware_widget_background"
  android:orientation="vertical"
  android:padding="12dp">

  <TextView
    android:id="@+id/airaware_widget_title"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:ellipsize="end"
    android:singleLine="true"
    android:textColor="@color/airaware_widget_text"
    android:textSize="14sp"
    android:textStyle="bold" />

  <TextView
    android:id="@+id/airaware_widget_score"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:ellipsize="end"
    android:singleLine="true"
    android:textSize="18sp"
    android:textStyle="bold" />

  <TextView
    android:id="@+id/airaware_widget_main_factor"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:ellipsize="end"
    android:singleLine="true"
    android:textColor="@color/airaware_widget_muted"
    android:textSize="12sp" />

  <TextView
    android:id="@+id/airaware_widget_uv"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:ellipsize="end"
    android:singleLine="true"
    android:textColor="@color/airaware_widget_muted"
    android:textSize="11sp" />

  <TextView
    android:id="@+id/airaware_widget_message"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:ellipsize="end"
    android:singleLine="true"
    android:textColor="@color/airaware_widget_muted"
    android:textSize="11sp" />
</LinearLayout>
`;

const ADVANCED_LAYOUT = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/airaware_widget_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:background="@drawable/airaware_widget_background"
  android:orientation="vertical"
  android:padding="14dp">

  <TextView
    android:id="@+id/airaware_widget_title"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:ellipsize="end"
    android:singleLine="true"
    android:textColor="@color/airaware_widget_text"
    android:textSize="15sp"
    android:textStyle="bold" />

  <TextView
    android:id="@+id/airaware_widget_score_label"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="6dp"
    android:textColor="@color/airaware_widget_muted"
    android:textSize="11sp"
    android:textStyle="bold" />

  <TextView
    android:id="@+id/airaware_widget_score"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:textSize="16sp"
    android:textStyle="bold" />

  <TextView
    android:id="@+id/airaware_widget_main_factor"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="6dp"
    android:ellipsize="end"
    android:maxLines="2"
    android:textColor="@color/airaware_widget_text"
    android:textSize="12sp" />

  <TextView
    android:id="@+id/airaware_widget_best_window"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="6dp"
    android:ellipsize="end"
    android:maxLines="2"
    android:textColor="@color/airaware_widget_text"
    android:textSize="12sp" />

  <TextView
    android:id="@+id/airaware_widget_forecast_label"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="6dp"
    android:text="Forecast"
    android:textColor="@color/airaware_widget_muted"
    android:textSize="11sp"
    android:textStyle="bold" />

  <TextView
    android:id="@+id/airaware_widget_forecast_1"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:ellipsize="end"
    android:singleLine="true"
    android:textColor="@color/airaware_widget_text"
    android:textSize="11sp" />

  <TextView
    android:id="@+id/airaware_widget_forecast_2"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:ellipsize="end"
    android:singleLine="true"
    android:textColor="@color/airaware_widget_text"
    android:textSize="11sp" />

  <TextView
    android:id="@+id/airaware_widget_forecast_3"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:ellipsize="end"
    android:singleLine="true"
    android:textColor="@color/airaware_widget_text"
    android:textSize="11sp" />

  <TextView
    android:id="@+id/airaware_widget_forecast_4"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:ellipsize="end"
    android:singleLine="true"
    android:textColor="@color/airaware_widget_text"
    android:textSize="11sp" />

  <TextView
    android:id="@+id/airaware_widget_message"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="4dp"
    android:textColor="@color/airaware_widget_muted"
    android:textSize="10sp" />
</LinearLayout>
`;

const COMPACT_INFO = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/airaware_compact_widget_description"
  android:initialLayout="@layout/airaware_widget_compact"
  android:minHeight="56dp"
  android:minResizeHeight="56dp"
  android:minResizeWidth="110dp"
  android:minWidth="110dp"
  android:resizeMode="horizontal|vertical"
  android:targetCellHeight="1"
  android:targetCellWidth="2"
  android:updatePeriodMillis="0"
  android:widgetCategory="home_screen" />
`;

const ADVANCED_INFO = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/airaware_advanced_widget_description"
  android:initialLayout="@layout/airaware_widget_advanced"
  android:minHeight="140dp"
  android:minResizeHeight="110dp"
  android:minResizeWidth="250dp"
  android:minWidth="250dp"
  android:resizeMode="horizontal|vertical"
  android:targetCellHeight="3"
  android:targetCellWidth="4"
  android:updatePeriodMillis="0"
  android:widgetCategory="home_screen" />
`;

const COLORS = `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <color name="airaware_widget_background">#F7FAF6</color>
  <color name="airaware_widget_text">#1F2A24</color>
  <color name="airaware_widget_muted">#65736B</color>
  <color name="airaware_widget_stroke">#D7E1DA</color>
</resources>
`;

const COLORS_NIGHT = `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <color name="airaware_widget_background">#17211B</color>
  <color name="airaware_widget_text">#EDF5EF</color>
  <color name="airaware_widget_muted">#B5C4BA</color>
  <color name="airaware_widget_stroke">#324139</color>
</resources>
`;

const BACKGROUND = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
  <solid android:color="@color/airaware_widget_background" />
  <stroke android:width="1dp" android:color="@color/airaware_widget_stroke" />
  <corners android:radius="18dp" />
</shape>
`;

const STRINGS = `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="airaware_compact_widget_name">AirAware</string>
  <string name="airaware_compact_widget_description">Compact AirAware current environmental summary.</string>
  <string name="airaware_advanced_widget_name">AirAware Pro</string>
  <string name="airaware_advanced_widget_description">Richer AirAware forecast and environmental summary.</string>
</resources>
`;

function writeAndroidWidgetFiles(projectRoot, packageName) {
  const base = path.join(projectRoot, 'android/app/src/main');
  const javaBase = path.join(base, 'java', javaPackagePath(packageName), 'widgets');
  const java = widgetJava(packageName);

  writeFile(path.join(javaBase, 'AirAwareWidgetSnapshot.java'), java.snapshot);
  writeFile(path.join(javaBase, 'AirAwareWidgetRenderer.java'), java.renderer);
  writeFile(path.join(javaBase, 'AirAwareCompactWidgetProvider.java'), java.compactProvider);
  writeFile(path.join(javaBase, 'AirAwareAdvancedWidgetProvider.java'), java.advancedProvider);
  writeFile(path.join(javaBase, 'AirAwareWidgetModule.java'), java.module);
  writeFile(path.join(javaBase, 'AirAwareWidgetPackage.java'), java.rnPackage);
  writeFile(path.join(base, 'res/layout/airaware_widget_compact.xml'), COMPACT_LAYOUT);
  writeFile(path.join(base, 'res/layout/airaware_widget_advanced.xml'), ADVANCED_LAYOUT);
  writeFile(path.join(base, 'res/xml/airaware_compact_widget_info.xml'), COMPACT_INFO);
  writeFile(path.join(base, 'res/xml/airaware_advanced_widget_info.xml'), ADVANCED_INFO);
  writeFile(path.join(base, 'res/values/airaware_widget_colors.xml'), COLORS);
  writeFile(path.join(base, 'res/values-night/airaware_widget_colors.xml'), COLORS_NIGHT);
  writeFile(path.join(base, 'res/drawable/airaware_widget_background.xml'), BACKGROUND);
  writeFile(path.join(base, 'res/values/airaware_widget_strings.xml'), STRINGS);
}

module.exports = function withAirAwareAndroidWidgets(config) {
  config = withAndroidManifest(config, (pluginConfig) => {
    if (!pluginConfig.modResults.manifest.$.package && !config.android?.package)
      return pluginConfig;

    pluginConfig.modResults = addReceiver(
      pluginConfig.modResults,
      'widgets.AirAwareCompactWidgetProvider',
      '@string/airaware_compact_widget_name',
      '@xml/airaware_compact_widget_info',
    );
    pluginConfig.modResults = addReceiver(
      pluginConfig.modResults,
      'widgets.AirAwareAdvancedWidgetProvider',
      '@string/airaware_advanced_widget_name',
      '@xml/airaware_advanced_widget_info',
    );
    pluginConfig.modResults = useRevenueCatSafeLaunchMode(pluginConfig.modResults);
    return pluginConfig;
  });

  return withDangerousMod(config, [
    'android',
    (pluginConfig) => {
      const packageName = pluginConfig.android?.package;
      if (!packageName) return pluginConfig;

      writeAndroidWidgetFiles(pluginConfig.modRequest.projectRoot, packageName);
      patchMainApplication(pluginConfig.modRequest.projectRoot, packageName);
      return pluginConfig;
    },
  ]);
};
