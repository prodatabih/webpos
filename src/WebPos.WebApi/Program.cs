using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using WebPos.Application.Interfaces;
using WebPos.Infrastructure.Persistence;
using WebPos.Infrastructure.Security;
using WebPos.WebApi.Services;

var builder = WebApplication.CreateBuilder(args);

var dbProvider = builder.Configuration["Database:Provider"] ?? "PostgreSql";
builder.Services.AddDbContext<WebPosDbContext>(options =>
{
    if (string.Equals(dbProvider, "Sqlite", StringComparison.OrdinalIgnoreCase))
    {
        var sqliteConn = builder.Configuration.GetConnectionString("Sqlite") ?? "Data Source=data/webpos_local.db";
        options.UseSqlite(sqliteConn);
    }
    else
    {
        var pgConn = builder.Configuration.GetConnectionString("PostgreSql")
                     ?? throw new InvalidOperationException("ConnectionStrings:PostgreSql is not configured.");
        options.UseNpgsql(pgConn);
    }
});

builder.Services.AddScoped<IWebPosDbContext>(sp => sp.GetRequiredService<WebPosDbContext>());
builder.Services.AddScoped<IPasswordHasher, Pbkdf2PasswordHasher>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<KepLedgerWriter>();

var jwtKey = builder.Configuration["Jwt:Key"]
             ?? builder.Configuration["Jwt:Secret"]
             ?? throw new InvalidOperationException("Jwt:Key or Jwt:Secret must be configured.");
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "WebPos.WebApi";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "WebPos.Client";

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddAuthorization();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                     ?? ["http://localhost:5173", "http://localhost:5000"];

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "WebPos Enterprise API", Version = "v1" });
    var securityScheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter JWT Bearer token"
    };
    c.AddSecurityDefinition("Bearer", securityScheme);
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<WebPosDbContext>();
    var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
    await ProductionDbSeeder.SeedAsync(db, hasher, app.Configuration);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();

var wwwRootPath = Path.Combine(app.Environment.ContentRootPath, "wwwroot");
var fallbackDistPath = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "WebPos.Web", "dist"));
var staticRoot = Directory.Exists(wwwRootPath)
    ? wwwRootPath
    : (Directory.Exists(fallbackDistPath) ? fallbackDistPath : null);

if (staticRoot is not null)
{
    var fileProvider = new PhysicalFileProvider(staticRoot);
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = fileProvider });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = fileProvider });
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

if (staticRoot is not null && File.Exists(Path.Combine(staticRoot, "index.html")))
{
    app.MapFallbackToFile("index.html", new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(staticRoot)
    });
}

app.Run();
